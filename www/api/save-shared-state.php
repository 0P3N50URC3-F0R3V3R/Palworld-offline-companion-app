<?php
header('Content-Type: application/json');

$body = file_get_contents('php://input');
$decoded = json_decode($body);
if ($decoded === null && json_last_error() !== JSON_ERROR_NONE) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'invalid json']);
    exit;
}

$dir = __DIR__ . '/../data-store';
if (!is_dir($dir)) mkdir($dir, 0777, true);
$file = $dir . '/state-shared.json';
$tmpFile = $file . '.tmp';
if (file_put_contents($tmpFile, $body) === false) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'write failed']);
    exit;
}
rename($tmpFile, $file);
echo json_encode(['ok' => true]);
