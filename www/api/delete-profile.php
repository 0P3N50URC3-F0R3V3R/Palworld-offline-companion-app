<?php
require __DIR__ . '/_profile-common.php';
header('Content-Type: application/json');

$decoded = json_decode(file_get_contents('php://input'), true);
$name = $decoded['name'] ?? '';
if (!palworld_validate_profile_name($name)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'invalid profile name']);
    exit;
}

$existing = glob(palworld_profiles_dir() . '/state_*.json');
if (count($existing) <= 1) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'cannot delete the only remaining profile']);
    exit;
}

$file = palworld_profile_file($name);
if (file_exists($file)) unlink($file);
echo json_encode(['ok' => true]);
