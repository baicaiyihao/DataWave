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

/// Generate a unique key ID for Seal encryption
/// Format: [package_id]::[survey_id]::[nonce]
public fun generate_seal_key_id(
    package_id: vector<u8>,
    survey_id: ID,
    nonce: u64,
): vector<u8> {
    let mut key_id = package_id;
    vector::append(&mut key_id, b"::");
    vector::append(&mut key_id, id_to_bytes(&survey_id));
    vector::append(&mut key_id, b"::");
    vector::append(&mut key_id, u64_to_bytes(nonce));
    key_id
}

/// Convert ID to bytes
public fun id_to_bytes(id: &ID): vector<u8> {
    id.to_bytes()
}

/// Convert u64 to bytes
public fun u64_to_bytes(value: u64): vector<u8> {
    let mut bytes = vector::empty<u8>();
    let mut v = value;
    
    if (v == 0) {
        vector::push_back(&mut bytes, 0);
        return bytes
    };
    
    while (v > 0) {
        vector::push_back(&mut bytes, ((v % 256) as u8));
        v = v / 256;
    };
    
    // Reverse the bytes for big-endian representation
    let len = vector::length(&bytes);
    let mut reversed = vector::empty<u8>();
    let mut i = len;
    while (i > 0) {
        i = i - 1;
        vector::push_back(&mut reversed, *vector::borrow(&bytes, i));
    };
    
    reversed
}

/// Calculate percentage
public fun calculate_percentage(value: u64, total: u64, basis_points: u64): u64 {
    if (total == 0) {
        0
    } else {
        (value * basis_points) / total
    }
}

/// Check if a timestamp has expired
public fun is_expired(current_time: u64, expiry_time: u64): bool {
    current_time >= expiry_time
}
