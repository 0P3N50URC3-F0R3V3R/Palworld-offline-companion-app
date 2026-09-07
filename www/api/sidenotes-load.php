<?php
require __DIR__ . '/_profile-common.php';
header('Content-Type: application/json');

$name = $_GET['user'] ?? '';
if (!palworld_validate_profile_name($name)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'invalid or missing user']);
    exit;
}

$file = __DIR__ . '/../data-store/sidenotes/' . $name . '.json';
if (file_exists($file)) {
    readfile($file);
} else {
    echo json_encode(['ok' => true, 'html' => '', 'updatedAt' => null]);
}
