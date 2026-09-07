<?php
require __DIR__ . '/_profile-common.php';
header('Content-Type: application/json');

$name = $_GET['user'] ?? '';
if (!palworld_validate_profile_name($name)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'invalid or missing user']);
    exit;
}

$body = json_decode(file_get_contents('php://input'), true) ?? [];
$html = (string)($body['html'] ?? '');

$plainText = trim(html_entity_decode(strip_tags($html)));
$textLen = count(preg_split('//u', $plainText, -1, PREG_SPLIT_NO_EMPTY));
if ($textLen > 25000) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'notes exceed 25000 characters']);
    exit;
}

$dir = __DIR__ . '/../data-store/sidenotes';
if (!is_dir($dir)) mkdir($dir, 0777, true);

$now = time();
$payload = json_encode(['ok' => true, 'html' => $html, 'updatedAt' => $now]);

$file = $dir . '/' . $name . '.json';
$tmpFile = $file . '.tmp';
if (file_put_contents($tmpFile, $payload) === false) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'write failed']);
    exit;
}
rename($tmpFile, $file);
echo $payload;
