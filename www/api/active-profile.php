<?php
require __DIR__ . '/_profile-common.php';
header('Content-Type: application/json');

$file = __DIR__ . '/../data-store/active-profile.json';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $decoded = json_decode(file_get_contents('php://input'), true);
    $name = $decoded['name'] ?? '';
    if (!palworld_validate_profile_name($name)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'invalid profile name']);
        exit;
    }
    $dir = dirname($file);
    if (!is_dir($dir)) mkdir($dir, 0777, true);
    file_put_contents($file . '.tmp', json_encode(['name' => $name]));
    rename($file . '.tmp', $file);
    echo json_encode(['ok' => true]);
} else {
    if (file_exists($file)) {
        readfile($file);
    } else {
        echo json_encode(['name' => null]);
    }
}
