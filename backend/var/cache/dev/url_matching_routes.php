<?php

/**
 * This file has been auto-generated
 * by the Symfony Routing Component.
 */

return [
    false, // $matchHost
    [ // $staticRoutes
        '/api/stats' => [[['_route' => 'api_stats_list', '_controller' => 'App\\Controller\\StatsApiController::list'], null, ['GET' => 0], null, false, false, null]],
    ],
    [ // $regexpList
        0 => '{^(?'
                .'|/_error/(\\d+)(?:\\.([^/]++))?(*:35)'
                .'|/api/stats/([^/]++)(?'
                    .'|(*:64)'
                    .'|/latest(*:78)'
                .')'
            .')/?$}sDu',
    ],
    [ // $dynamicRoutes
        35 => [[['_route' => '_preview_error', '_controller' => 'error_controller::preview', '_format' => 'html'], ['code', '_format'], null, null, false, true, null]],
        64 => [[['_route' => 'api_stats_metric', '_controller' => 'App\\Controller\\StatsApiController::metric'], ['metric'], ['GET' => 0], null, false, true, null]],
        78 => [
            [['_route' => 'api_stats_metric_latest', '_controller' => 'App\\Controller\\StatsApiController::latest'], ['metric'], ['GET' => 0], null, false, false, null],
            [null, null, null, null, false, false, 0],
        ],
    ],
    null, // $checkCondition
];
