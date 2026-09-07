<?php
header('Content-Type: application/json');

$body = file_get_contents('php://input');
$decoded = json_decode($body, true);
if ($decoded === null || empty($decoded['name']) || empty($decoded['dataUrl'])) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'expected {name, dataUrl}']);
    exit;
}

$name = $decoded['name'];
$dataUrl = $decoded['dataUrl'];

if (!preg_match('/^data:image\/(png|jpeg|jpg);base64,(.+)$/', $dataUrl, $m)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'dataUrl must be a base64 PNG or JPEG data URL']);
    exit;
}
$imageBytes = base64_decode($m[2], true);
if ($imageBytes === false) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'invalid base64 data']);
    exit;
}

$slug = strtolower(preg_replace('/[^a-z0-9]+/', '-', $name));
$slug = trim($slug, '-');
$iconDir = __DIR__ . '/../oyster.ignimgs.com/mediawiki/pal-icons';
if (!is_dir($iconDir)) mkdir($iconDir, 0777, true);
$iconPath = $iconDir . '/' . $slug . '.png';
if (file_put_contents($iconPath, $imageBytes) === false) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'failed to write icon file']);
    exit;
}

$dataDir = __DIR__ . '/../data';
$backupDir = $dataDir . '/backups';
if (!is_dir($backupDir)) mkdir($backupDir, 0777, true);
$mapFile = $dataDir . '/pal-icons.json';
$mapping = file_exists($mapFile) ? json_decode(file_get_contents($mapFile), true) : [];
if (!is_array($mapping)) $mapping = [];
if (file_exists($mapFile)) {
    copy($mapFile, $backupDir . '/pal-icons-' . date('Ymd-His') . '.json');
}
$mapping[$name] = 'oyster.ignimgs.com/mediawiki/pal-icons/' . $slug . '.png';
file_put_contents($mapFile . '.tmp', json_encode($mapping));
rename($mapFile . '.tmp', $mapFile);

echo json_encode(['ok' => true, 'iconUrl' => $mapping[$name]]);
