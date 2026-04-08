package com.tinsu.mobile.setup

enum class SetupStep(val index: Int) {
    WELCOME(0),
    HOST_DETAILS(1),
    GENERATE_KEY(2),
    VIEW_PUBLIC_KEY(3),
    AUTHORIZED_KEYS_INSTRUCTIONS(4),
    TEST_CONNECTION(5),
    SAVE_CONNECTION(6);

    companion object {
        val ALL_STEPS = entries
        val TOTAL_STEPS = ALL_STEPS.size

        fun fromIndex(index: Int): SetupStep =
            ALL_STEPS.getOrElse(index) { WELCOME }
    }
}
