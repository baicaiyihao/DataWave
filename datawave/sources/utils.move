// Copyright (c) 2025, DataWave Survey Platform
// SPDX-License-Identifier: Apache-2.0

module datawave::utils;

/// Check if a vector is a prefix of another vector
public fun is_prefix(prefix: vector<u8>, data: vector<u8>): bool {
    let prefix_len = vector::length(&prefix);
    let data_len = vector::length(&data);
    
    if (prefix_len > data_len) {
        return false
    };
    
    let mut i = 0;
    while (i < prefix_len) {
        if (*vector::borrow(&prefix, i) != *vector::borrow(&data, i)) {
            return false
        };
        i = i + 1;
    };
    
    true
}
