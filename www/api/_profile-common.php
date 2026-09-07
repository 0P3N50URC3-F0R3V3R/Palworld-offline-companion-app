<?php
function palworld_profiles_dir() {
    $dir = __DIR__ . '/../data-store/profiles';
    if (!is_dir($dir)) mkdir($dir, 0777, true);
    return $dir;
}

function palworld_validate_profile_name($name) {
    return is_string($name) && preg_match('/^[A-Za-z0-9 _-]{1,30}$/', $name) === 1;
}

function palworld_profile_file($name) {
    return palworld_profiles_dir() . '/state_' . $name . '.json';
}
