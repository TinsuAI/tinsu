package com.tinsu.mobile.connection

/**
 * Transport protocol type for remote connections.
 */
enum class TransportType {
    SSH,
    MOSH;

    val displayName: String
        get() = when (this) {
            SSH -> "SSH"
            MOSH -> "mosh"
        }

    val defaultValue: TransportType
        get() = SSH

    /**
     * Converts the enum to the database string value.
     */
    fun toDbValue(): String = name.lowercase()

    companion object {
        /**
         * Creates a TransportType from a database string value.
         * Defaults to SSH if the value is invalid.
         */
        fun fromDbValue(value: String?): TransportType =
            when (value?.lowercase()) {
                "mosh" -> MOSH
                "ssh", null -> SSH
                else -> SSH
            }
    }
}
