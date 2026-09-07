<?php
require __DIR__ . '/_profile-common.php';
header('Content-Type: application/json');

$name = $_GET['user'] ?? '';
if (!palworld_validate_profile_name($name)) {
    http_response_code(400);
    echo json_encode(['error' => 'invalid or missing user']);
    exit;
}

$file = palworld_profile_file($name);
if (file_exists($file)) {
    readfile($file);
} else {
    echo '{}';
}
