package com.tinsu.mobile.setup

import com.tinsu.mobile.connection.ConnectionRepository
import com.tinsu.mobile.db.TinsuMobile
import com.tinsu.mobile.util.Result
import kotlinx.datetime.Clock

class SetupDetector(
    private val repository: ConnectionRepository,
    private val database: TinsuMobile
) {
    suspend fun shouldShowSetup(): Boolean {
        // Check if setup is already completed
        val prefs = database.appPreferencesQueries.selectByKey(SETUP_COMPLETED_KEY).executeAsOneOrNull()
        if (prefs != null && prefs.value_ == "true") {
            return false
        }

        // Check if connections exist
        return when (val result = repository.getAllConnections()) {
            is Result.Success -> result.data.isEmpty()
            is Result.Failure -> true // If we can't load connections, show setup
        }
    }

    fun markSetupCompleted() {
        val now = Clock.System.now().toEpochMilliseconds()
        database.appPreferencesQueries.insert(SETUP_COMPLETED_KEY, "true", now)
    }

    fun markSetupSkipped() {
        val now = Clock.System.now().toEpochMilliseconds()
        database.appPreferencesQueries.insert(SETUP_SKIPPED_KEY, "true", now)
    }

    fun isSetupSkipped(): Boolean {
        val prefs = database.appPreferencesQueries.selectByKey(SETUP_SKIPPED_KEY).executeAsOneOrNull()
        return prefs != null && prefs.value_ == "true"
    }

    fun saveSetupProgress(stepIndex: Int) {
        val now = Clock.System.now().toEpochMilliseconds()
        database.appPreferencesQueries.insert(SETUP_IN_PROGRESS_KEY, stepIndex.toString(), now)
    }

    fun getSetupProgress(): Int? {
        val prefs = database.appPreferencesQueries.selectByKey(SETUP_IN_PROGRESS_KEY).executeAsOneOrNull()
        return prefs?.value_?.toIntOrNull()
    }

    fun clearSetupProgress() {
        database.appPreferencesQueries.deleteByKey(SETUP_IN_PROGRESS_KEY)
    }

    companion object {
        internal const val SETUP_COMPLETED_KEY = "setup_completed"
        internal const val SETUP_SKIPPED_KEY = "setup_skipped"
        internal const val SETUP_IN_PROGRESS_KEY = "setup_in_progress"
    }
}
