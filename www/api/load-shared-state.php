<?php
header('Content-Type: application/json');
$file = __DIR__ . '/../data-store/state-shared.json';
if (file_exists($file)) {
    readfile($file);
} else {
    echo '{}';
}
