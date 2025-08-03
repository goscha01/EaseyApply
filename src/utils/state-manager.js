import { CONFIG } from '../config/constants.js';

/**
 * Centralized state management for the extension
 */
export class StateManager {
  constructor() {
    this.state = {
      // Application state
      isRunning: false,
      currentJob: null,
      applicationCount: 0,
      totalJobs: 0,
      currentIndex: 0,
      
      // User settings
      settings: {
        skills: '',
        jobLocation: '',
        jobCount: 10,
        jobType: '',
        delay: CONFIG.APPLICATION.DEFAULT_DELAY,
        autoFill: true
      },
      
      // Job data
      jobLinks: [],
      appliedJobs: [],
      failedJobs: [],
      
      // Progress tracking
      progress: {
        current: 0,
        total: 0,
        percentage: 0
      },
      
      // Error tracking
      errors: [],
      
      // Session data
      sessionId: this.generateSessionId(),
      startTime: null,
      endTime: null
    };
    
    this.listeners = [];
    this.initializeState();
  }
  
  /**
   * Generate unique session ID
   * @returns {string} Session ID
   */
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Initialize state from storage
   */
  async initializeState() {
    try {
      const storedData = await this.getFromStorage([
        'applicationState',
        'settings',
        'jobData'
      ]);
      
      if (storedData.settings) {
        this.state.settings = { ...this.state.settings, ...storedData.settings };
      }
      
      if (storedData.jobData) {
        this.state.settings = { ...this.state.settings, ...storedData.jobData };
      }
      
      if (storedData.applicationState) {
        this.state = { ...this.state, ...storedData.applicationState };
      }
    } catch (error) {
      console.error('Failed to initialize state:', error);
    }
  }
  
  /**
   * Set state with validation
   * @param {Object} newState - New state to merge
   * @param {boolean} persist - Whether to persist to storage
   */
  setState(newState, persist = true) {
    const oldState = { ...this.state };
    this.state = { ...this.state, ...newState };
    
    // Update progress percentage
    if (this.state.progress.total > 0) {
      this.state.progress.percentage = Math.round(
        (this.state.progress.current / this.state.progress.total) * 100
      );
    }
    
    // Validate state
    this.validateState();
    
    // Notify listeners
    this.notifyListeners(oldState, this.state);
    
    // Persist to storage if requested
    if (persist) {
      this.persistState();
    }
  }
  
  /**
   * Validate state integrity
   */
  validateState() {
    // Ensure progress doesn't exceed total
    if (this.state.progress.current > this.state.progress.total) {
      this.state.progress.current = this.state.progress.total;
    }
    
    // Ensure job count is within limits
    if (this.state.settings.jobCount > CONFIG.APPLICATION.MAX_JOBS_PER_SESSION) {
      this.state.settings.jobCount = CONFIG.APPLICATION.MAX_JOBS_PER_SESSION;
    }
    
    if (this.state.settings.jobCount < CONFIG.APPLICATION.MIN_JOBS_PER_SESSION) {
      this.state.settings.jobCount = CONFIG.APPLICATION.MIN_JOBS_PER_SESSION;
    }
  }
  
  /**
   * Subscribe to state changes
   * @param {Function} listener - Listener function
   * @returns {Function} Unsubscribe function
   */
  subscribe(listener) {
    this.listeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }
  
  /**
   * Notify all listeners of state change
   * @param {Object} oldState - Previous state
   * @param {Object} newState - Current state
   */
  notifyListeners(oldState, newState) {
    this.listeners.forEach(listener => {
      try {
        listener(newState, oldState);
      } catch (error) {
        console.error('Error in state listener:', error);
      }
    });
  }
  
  /**
   * Get current state
   * @returns {Object} Current state
   */
  getState() {
    return { ...this.state };
  }
  
  /**
   * Get specific state property
   * @param {string} key - State key
   * @returns {*} State value
   */
  getStateProperty(key) {
    return this.state[key];
  }
  
  /**
   * Start application session
   * @param {Object} settings - Application settings
   */
  startSession(settings) {
    this.setState({
      isRunning: true,
      startTime: new Date().toISOString(),
      settings: { ...this.state.settings, ...settings },
      progress: {
        current: 0,
        total: settings.jobCount || 10,
        percentage: 0
      },
      applicationCount: 0,
      currentIndex: 0,
      jobLinks: [],
      appliedJobs: [],
      failedJobs: [],
      errors: []
    });
  }
  
  /**
   * Stop application session
   */
  stopSession() {
    this.setState({
      isRunning: false,
      endTime: new Date().toISOString()
    });
  }
  
  /**
   * Update progress
   * @param {number} current - Current progress
   * @param {number} total - Total jobs
   */
  updateProgress(current, total = null) {
    const newProgress = {
      current,
      total: total || this.state.progress.total,
      percentage: total ? Math.round((current / total) * 100) : this.state.progress.percentage
    };
    
    this.setState({
      progress: newProgress,
      applicationCount: current
    });
  }
  
  /**
   * Add job link
   * @param {string} jobLink - Job URL
   */
  addJobLink(jobLink) {
    this.setState({
      jobLinks: [...this.state.jobLinks, jobLink]
    });
  }
  
  /**
   * Mark job as applied
   * @param {Object} jobData - Job data
   */
  markJobApplied(jobData) {
    this.setState({
      appliedJobs: [...this.state.appliedJobs, jobData],
      currentJob: null
    });
  }
  
  /**
   * Mark job as failed
   * @param {Object} jobData - Job data with error
   */
  markJobFailed(jobData) {
    this.setState({
      failedJobs: [...this.state.failedJobs, jobData],
      currentJob: null
    });
  }
  
  /**
   * Add error
   * @param {Error} error - Error object
   * @param {string} context - Error context
   */
  addError(error, context) {
    const errorInfo = {
      message: error.message,
      context,
      timestamp: new Date().toISOString(),
      stack: error.stack
    };
    
    this.setState({
      errors: [...this.state.errors, errorInfo]
    });
  }
  
  /**
   * Get session statistics
   * @returns {Object} Session statistics
   */
  getSessionStats() {
    const duration = this.state.endTime && this.state.startTime 
      ? new Date(this.state.endTime) - new Date(this.state.startTime)
      : Date.now() - new Date(this.state.startTime);
    
    return {
      sessionId: this.state.sessionId,
      duration: Math.round(duration / 1000), // seconds
      totalJobs: this.state.progress.total,
      appliedJobs: this.state.appliedJobs.length,
      failedJobs: this.state.failedJobs.length,
      successRate: this.state.progress.total > 0 
        ? Math.round((this.state.appliedJobs.length / this.state.progress.total) * 100)
        : 0,
      errors: this.state.errors.length
    };
  }
  
  /**
   * Persist state to storage
   */
  async persistState() {
    try {
      const dataToStore = {
        applicationState: {
          isRunning: this.state.isRunning,
          applicationCount: this.state.applicationCount,
          progress: this.state.progress,
          sessionId: this.state.sessionId,
          startTime: this.state.startTime,
          endTime: this.state.endTime
        },
        settings: this.state.settings
      };
      
      await this.setInStorage(dataToStore);
    } catch (error) {
      console.error('Failed to persist state:', error);
    }
  }
  
  /**
   * Get data from storage
   * @param {Array} keys - Storage keys
   * @returns {Promise<Object>} Stored data
   */
  getFromStorage(keys) {
    return new Promise((resolve) => {
      chrome.storage.local.get(keys, resolve);
    });
  }
  
  /**
   * Set data in storage
   * @param {Object} data - Data to store
   * @returns {Promise} Storage promise
   */
  setInStorage(data) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set(data, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }
  
  /**
   * Clear state and storage
   */
  async clearState() {
    this.state = {
      isRunning: false,
      currentJob: null,
      applicationCount: 0,
      totalJobs: 0,
      currentIndex: 0,
      settings: this.state.settings, // Keep settings
      jobLinks: [],
      appliedJobs: [],
      failedJobs: [],
      progress: { current: 0, total: 0, percentage: 0 },
      errors: [],
      sessionId: this.generateSessionId(),
      startTime: null,
      endTime: null
    };
    
    await this.setInStorage({
      applicationState: null,
      errorLog: null
    });
    
    this.notifyListeners({}, this.state);
  }
}

// Create global state manager instance
export const stateManager = new StateManager(); 