<?php
require __DIR__ . '/_profile-common.php';
header('Content-Type: application/json');

$profiles = [];
foreach (glob(palworld_profiles_dir() . '/state_*.json') as $path) {
    $base = basename($path, '.json');
    $profiles[] = substr($base, strlen('state_'));
}
sort($profiles);
echo json_encode(['profiles' => $profiles]);
