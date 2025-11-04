<?php
namespace App\Controller;

use Doctrine\DBAL\Connection;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;

#[Route('/api', name: 'api_')]
class StatsApiController extends AbstractController
{
    public function __construct(private readonly Connection $db) {}

    #[Route('/stats', name: 'stats_list', methods: ['GET'])]
    public function list(): JsonResponse
    {
        $platform = $this->db->getDatabasePlatform();
        $isPg = $platform instanceof \Doctrine\DBAL\Platforms\PostgreSQLPlatform;

        if ($isPg) {
            $sql = "SELECT tablename AS table_name
                    FROM pg_tables
                    WHERE schemaname='public' AND tablename LIKE 'cs_%'
                    ORDER BY tablename";
            $rows = $this->db->fetchAllAssociative($sql);
        } else {
            // MariaDB/MySQL: usa INFORMATION_SCHEMA (más estable que SHOW TABLES LIKE)
            $sql = "SELECT table_name
                    AS table_name
                    FROM information_schema.tables
                    WHERE table_schema = DATABASE()
                      AND table_name LIKE 'cs\_%' ESCAPE '\\\\'
                    ORDER BY table_name";
            $rows = $this->db->fetchAllAssociative($sql);
        }

        // Extrae el nombre "limpio" de la métrica (sin prefijo cs_)
        $metrics = [];
        foreach ($rows as $r) {
            $t = $r['table_name'] ?? null;
            if ($t && str_starts_with($t, 'cs_')) {
                $metrics[] = substr($t, 3); // quita "cs_"
            }
        }

        return $this->json([
            'count' => count($metrics),
            'metrics' => $metrics,
        ]);
    }

    #[Route('/stats/{metric}', name: 'stats_metric', methods: ['GET'])]
    public function metric(string $metric, Request $req): JsonResponse
    {
        $table = $this->metricToTable($metric);
        if (!$this->tableExists($table)) {
            return $this->json(['error' => "Metric not found: $metric"], 404);
        }

        // Filtros opcionales: from, to (ISO 8601 o 'YYYY-MM-DD HH:MM:SS'), limit (por defecto 1000)
        $from = $req->query->get('from'); // string|null
        $to   = $req->query->get('to');   // string|null
        $limit = (int)($req->query->get('limit') ?? 1000);
        $limit = max(1, min($limit, 50000)); // seguridad

        // Construye SQL con filtros opcionales
        $platform = $this->db->getDatabasePlatform();
        $isPg = $platform instanceof \Doctrine\DBAL\Platforms\PostgreSQLPlatform;

        $conds = [];
        $params = [];
        $types  = [];

        if ($from) {
            $conds[] = "captured_at >= " . ($isPg ? ":from" : "?");
            $params[] = $from;
            $types[]  = \PDO::PARAM_STR;
        }
        if ($to) {
            $conds[] = "captured_at <= " . ($isPg ? ":to" : "?");
            $params[] = $to;
            $types[]  = \PDO::PARAM_STR;
        }

        $where = $conds ? ('WHERE ' . implode(' AND ', $conds)) : '';
        $order = "ORDER BY captured_at ASC";

        if ($isPg) {
            $sql = "SELECT captured_at, value FROM {$table} {$where} {$order} LIMIT :limit";
            $stmt = $this->db->prepare($sql);
            // enlaza from/to si existen
            $i = 0;
            if ($from) $stmt->bindValue(':from', $params[$i++], \PDO::PARAM_STR);
            if ($to)   $stmt->bindValue(':to',   $params[$i++], \PDO::PARAM_STR);
            $stmt->bindValue(':limit', $limit, \PDO::PARAM_INT);
            $rows = $stmt->executeQuery()->fetchAllAssociative();
        } else {
            $sql = "SELECT captured_at, value FROM {$table} {$where} {$order} LIMIT ?";
            $params[] = $limit;
            $types[]  = \PDO::PARAM_INT;
            $rows = $this->db->executeQuery($sql, $params, $types)->fetchAllAssociative();
        }

        // Normaliza timestamps a ISO8601 en la salida (mantiene null en value si procede)
        $out = array_map(function($r) {
            $ts = $r['captured_at'] ?? null;
            $iso = null;
            if ($ts) {
                try {
                    $iso = (new \DateTimeImmutable($ts))->format(\DateTimeInterface::ATOM);
                } catch (\Throwable $e) {
                    $iso = $ts; // deja tal cual si falla el parseo
                }
            }
            return [
                'captured_at' => $iso,
                'value'       => isset($r['value']) && $r['value'] !== '' ? (float)$r['value'] : null,
            ];
        }, $rows);

        return $this->json([
            'metric' => $metric,
            'count'  => count($out),
            'data'   => $out,
        ]);
    }

    #[Route('/stats/{metric}/latest', name: 'stats_metric_latest', methods: ['GET'])]
    public function latest(string $metric): JsonResponse
    {
        $table = $this->metricToTable($metric);
        if (!$this->tableExists($table)) {
            return $this->json(['error' => "Metric not found: $metric"], 404);
        }

        $platform = $this->db->getDatabasePlatform();
        $isPg = $platform instanceof \Doctrine\DBAL\Platforms\PostgreSQLPlatform;

        $sql = "SELECT captured_at, value FROM {$table} ORDER BY captured_at DESC LIMIT 1";
        $row = $this->db->fetchAssociative($sql);

        if (!$row) {
            return $this->json(['metric' => $metric, 'data' => null]);
        }

        $iso = null;
        if (!empty($row['captured_at'])) {
            try {
                $iso = (new \DateTimeImmutable($row['captured_at']))->format(\DateTimeInterface::ATOM);
            } catch (\Throwable $e) {
                $iso = $row['captured_at'];
            }
        }

        return $this->json([
            'metric' => $metric,
            'data' => [
                'captured_at' => $iso,
                'value' => isset($row['value']) && $row['value'] !== '' ? (float)$row['value'] : null,
            ]
        ]);
    }

    // ---------- helpers ----------

    /**
     * Convierte "active_addresses_24h" -> "cs_active_addresses_24h"
     */
    private function metricToTable(string $metric): string
    {
        $safe = strtolower(preg_replace('/[^a-z0-9_]+/i', '_', $metric));
        return 'cs_' . $safe;
    }

    private function tableExists(string $table): bool
    {
        $platform = $this->db->getDatabasePlatform();
        $isPg = $platform instanceof \Doctrine\DBAL\Platforms\PostgreSQLPlatform;

        if ($isPg) {
            $sql = "SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename = :t LIMIT 1";
            $r = $this->db->fetchOne($sql, ['t' => $table]);
            return (bool)$r;
        }

        // MariaDB/MySQL
        $sql = "SELECT 1
                FROM information_schema.tables
                WHERE table_schema = DATABASE() AND table_name = ?
                LIMIT 1";
        $r = $this->db->fetchOne($sql, [$table]);
        return (bool)$r;
    }
}
