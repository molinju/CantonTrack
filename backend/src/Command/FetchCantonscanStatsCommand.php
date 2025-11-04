<?php
namespace App\Command;

use Doctrine\DBAL\Connection;
use Doctrine\DBAL\ParameterType;
use Doctrine\DBAL\Platforms\PostgreSQLPlatform;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Contracts\HttpClient\HttpClientInterface;

#[AsCommand(
    name: 'app:fetch-cantonscan-stats',
    description: 'Fetch Cantonscan /api/stats and insert (captured_at, value) per stat key (idempotent)'
)]
class FetchCantonscanStatsCommand extends Command
{
    public function __construct(
        private readonly HttpClientInterface $http,
        private readonly Connection $db
    ) {
        parent::__construct();
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $url = 'https://www.cantonscan.com/api/stats';
        $output->writeln("<info>Fetching:</info> $url");

        try {
            $resp = $this->http->request('GET', $url, ['timeout' => 20]);
            $data = $resp->toArray(false);
            if (!\is_array($data)) {
                $output->writeln('<error>Unexpected response (expecting JSON object)</error>');
                return Command::FAILURE;
            }
        } catch (\Throwable $e) {
            $output->writeln('<error>Request failed: '.$e->getMessage().'</error>');
            return Command::FAILURE;
        }

        $platform = $this->db->getDatabasePlatform();
        $isPg = $platform instanceof PostgreSQLPlatform;

        // Timestamp en UTC
        $nowUtc = (new \DateTimeImmutable('now', new \DateTimeZone('UTC')))->format('Y-m-d H:i:sP');

        $inserted = 0;

        $this->db->beginTransaction();
        try {
            foreach ($data as $key => $value) {
                $table = 'cs_' . preg_replace('/[^a-z0-9_]+/i', '_', strtolower((string)$key));
                if ($table === 'cs_') {
                    continue;
                }

                // DDL (idempotente) + índice único por timestamp
                foreach ($this->ddlCreateIfNotExists($isPg, $table) as $sql) {
                    $this->db->executeStatement($sql);
                }
                foreach ($this->ensureUniqueIndex($isPg, $table) as $sql) {
                    $this->db->executeStatement($sql);
                }

                // Normaliza a string numérica para NUMERIC/DECIMAL (evita float)
                $numStr = $this->toNumericString($value);

                if ($isPg) {
                    // UPSERT en Postgres
                    $sql = "INSERT INTO {$table} (captured_at, value)
                            VALUES (:ts, :val)
                            ON CONFLICT (captured_at)
                            DO UPDATE SET value = EXCLUDED.value";
                    $this->db->executeStatement(
                        $sql,
                        ['ts' => $nowUtc, 'val' => $numStr],
                        ['ts' => ParameterType::STRING, 'val' => ParameterType::STRING]
                    );
                } else {
                    // MySQL/MariaDB
                    $sql = "INSERT INTO {$table} (captured_at, value)
                            VALUES (?, ?)
                            ON DUPLICATE KEY UPDATE value = VALUES(value)";
                    $this->db->executeStatement(
                        $sql,
                        [$nowUtc, $numStr],
                        [ParameterType::STRING, ParameterType::STRING]
                    );
                }

                $inserted++;
                $output->writeln(sprintf('✔ %s -> %s', $key, $numStr ?? 'NULL'));
            }

            $this->db->commit();
        } catch (\Throwable $e) {
            $this->db->rollBack();
            $output->writeln("❌ <error>Transaction failed:</error> ".$e->getMessage());
            return Command::FAILURE;
        }

        $output->writeln("<info>Done. Upserted rows:</info> {$inserted}");
        return Command::SUCCESS;
    }

    private function toNumericString(mixed $value): ?string
    {
        if (is_int($value) || is_float($value)) {
            // Evita notación científica: castea a string “plain”
            return rtrim(rtrim(number_format((float)$value, 18, '.', ''), '0'), '.') ?: '0';
        }
        if (is_string($value)) {
            $clean = str_replace([',', ' '], ['', ''], $value);
            if (is_numeric($clean)) {
                return rtrim(rtrim(number_format((float)$clean, 18, '.', ''), '0'), '.') ?: '0';
            }
        }
        // valores no numéricos → NULL
        return null;
    }

    /** DDL por plataforma */
    private function ddlCreateIfNotExists(bool $isPg, string $table): array
    {
        if ($isPg) {
            return [
                "CREATE TABLE IF NOT EXISTS {$table} (
                    id BIGSERIAL PRIMARY KEY,
                    captured_at TIMESTAMPTZ NOT NULL,
                    value NUMERIC NULL
                )",
                "CREATE INDEX IF NOT EXISTS {$table}_captured_at_idx ON {$table}(captured_at)"
            ];
        }
        return [
            "CREATE TABLE IF NOT EXISTS {$table} (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                captured_at DATETIME NOT NULL,
                value DECIMAL(36,18) NULL,
                PRIMARY KEY(id),
                UNIQUE KEY {$table}_ts_unique (captured_at),
                INDEX {$table}_captured_at_idx (captured_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
        ];
    }

    /** Índice único por timestamp (Postgres) */
    private function ensureUniqueIndex(bool $isPg, string $table): array
    {
        if (!$isPg) return [];
        return [
            "CREATE UNIQUE INDEX IF NOT EXISTS {$table}_ts_unique ON {$table}(captured_at)"
        ];
    }
}
