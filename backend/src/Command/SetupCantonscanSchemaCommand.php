<?php
namespace App\Command;

use Doctrine\DBAL\Connection;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Contracts\HttpClient\HttpClientInterface;

/**
 * Crea tablas por métrica a partir de https://www.cantonscan.com/api/stats
 * Formato por tabla: cs_<clave> (captured_at DATETIME/TIMESTAMPTZ, value NUMERIC/DECIMAL)
 */
#[AsCommand(
    name: 'app:setup-cantonscan-schema',
    description: 'Create per-metric tables (captured_at, value) for all keys from Cantonscan /api/stats'
)]
class SetupCantonscanSchemaCommand extends Command
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
        $output->writeln("<info>Fetching keys from:</info> $url");

        try {
            $resp = $this->http->request('GET', $url, ['timeout' => 20]);
            $data = $resp->toArray(false);
            if (!is_array($data)) {
                $output->writeln('<error>Unexpected response; expecting JSON object</error>');
                return Command::FAILURE;
            }
        } catch (\Throwable $e) {
            $output->writeln('<error>Failed to fetch /api/stats: '.$e->getMessage().'</error>');
            return Command::FAILURE;
        }

        $platform = $this->db->getDatabasePlatform(); // DBAL 3+: devuelve un objeto Platform
        $isPg = $platform instanceof \Doctrine\DBAL\Platforms\PostgreSQLPlatform;

        $created = 0;
        foreach ($data as $key => $val) {
            $table = 'cs_' . preg_replace('/[^a-z0-9_]+/i', '_', strtolower((string)$key));
            if ($table === 'cs_') {
                continue;
            }

            try {
                foreach ($this->ddlCreateIfNotExists($platform, $table) as $sql) {
                    $this->db->executeStatement($sql);
                }
                $created++;
                $output->writeln("✔ Table ensured: <comment>{$table}</comment>");
            } catch (\Throwable $e) {
                $output->writeln("❌ <error>Failed creating {$table}: {$e->getMessage()}</error>");
            }
        }

        $output->writeln("<info>Done. Tables ensured: {$created}</info>");
        $this->printHints($isPg, $output);
        return Command::SUCCESS;
    }

    /**
     * DDL por plataforma para crear la tabla si no existe (DBAL 3+)
     * @param object $platform instancia de Platform (p.ej. PostgreSQLPlatform, MariaDBPlatform, MySQLPlatform)
     */
    private function ddlCreateIfNotExists(object $platform, string $table): array
    {
        $isPg = $platform instanceof \Doctrine\DBAL\Platforms\PostgreSQLPlatform;

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

        // MariaDB/MySQL (DDEV por defecto)
        return [
            "CREATE TABLE IF NOT EXISTS {$table} (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                captured_at DATETIME NOT NULL,
                value DECIMAL(36,18) NULL,
                PRIMARY KEY(id),
                INDEX {$table}_captured_at_idx (captured_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
        ];
    }

    private function printHints(bool $isPg, OutputInterface $output): void
    {
        $output->writeln("");
        $output->writeln("<info>Quick verify (Doctrine SQL):</info>");
        if ($isPg) {
            $output->writeln("  php bin/console doctrine:query:sql \"SELECT tablename FROM pg_tables WHERE tablename LIKE 'cs_%' ORDER BY 1\"");
        } else {
            $output->writeln("  php bin/console doctrine:query:sql \"SHOW TABLES LIKE 'cs_%'\"");
        }
        $output->writeln("");
    }
}
