package com.tinsu.mobile.connection

import com.tinsu.mobile.db.TinsuMobile

/**
 * Factory for creating platform-specific ConnectionRepository implementations.
 */
expect fun createConnectionRepository(database: TinsuMobile): ConnectionRepository
