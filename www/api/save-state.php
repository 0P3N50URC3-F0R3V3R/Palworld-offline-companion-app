<?php
require __DIR__ . '/_profile-common.php';
header('Content-Type: application/json');

$name = $_GET['user'] ?? '';
if (!palworld_validate_profile_name($name)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'invalid or missing user']);
    exit;
}

$body = file_get_contents('php://input');
$decoded = json_decode($body);
if ($decoded === null && json_last_error() !== JSON_ERROR_NONE) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'invalid json']);
    exit;
}

$file = palworld_profile_file($name);
$tmpFile = $file . '.tmp';
if (file_put_contents($tmpFile, $body) === false) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'write failed']);
    exit;
}
rename($tmpFile, $file);
echo json_encode(['ok' => true]);
