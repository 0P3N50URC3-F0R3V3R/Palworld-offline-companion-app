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

$file = palworld_profile_file($name);
if (file_exists($file)) {
    http_response_code(409);
    echo json_encode(['ok' => false, 'error' => 'profile already exists']);
    exit;
}
file_put_contents($file, '{}');
echo json_encode(['ok' => true]);
