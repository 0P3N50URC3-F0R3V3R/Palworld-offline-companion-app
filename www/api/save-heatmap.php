<?php
header('Content-Type: application/json');

$body = file_get_contents('php://input');
$decoded = json_decode($body);
if ($decoded === null || !is_object($decoded)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'invalid json - expected an object']);
    exit;
}

$dataDir = __DIR__ . '/../data';
$backupDir = $dataDir . '/backups';
if (!is_dir($backupDir)) mkdir($backupDir, 0777, true);

$file = $dataDir . '/heatmap.json';
if (file_exists($file)) {
    $backupFile = $backupDir . '/heatmap-' . date('Ymd-His') . '.json';
    copy($file, $backupFile);
}

$tmpFile = $file . '.tmp';
if (file_put_contents($tmpFile, $body) === false) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'write failed']);
    exit;
}
rename($tmpFile, $file);

echo json_encode(['ok' => true]);
