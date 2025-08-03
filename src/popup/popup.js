// EasyApply Side Panel JavaScript
class EasyApplySidePanel {
    constructor() {
        this.isRunning = false;
        this.currentJob = null;
        this.stats = {
            applied: 0,
            failed: 0,
            total: 0
        };
        this.sidePanelWindow = null;
        this.init();
    }

    init() {
        this.createSidePanel();
        this.bindEvents();
        this.loadSettings();
        this.updateStatus('Ready');
    }

    createSidePanel() {
        // Create the side panel window
        const panelWidth = Math.floor(window.screen.width * 0.3); // 30% of screen width
        const panelHeight = window.screen.height;
        const panelLeft = window.screen.width - panelWidth;
        
        this.sidePanelWindow = window.open(
            chrome.runtime.getURL('src/sidepanel/sidepanel.html'),
            'EasyApplySidePanel',
            `width=${panelWidth},height=${panelHeight},left=${panelLeft},top=0,scrollbars=yes,resizable=yes,status=no,location=no,toolbar=no,menubar=no`
        );

        // Handle window close
        this.sidePanelWindow.onbeforeunload = () => {
            this.cleanup();
        };

        // Wait for the panel to load
        this.sidePanelWindow.onload = () => {
            this.initializePanel();
        };
    }

    initializePanel() {
        // Inject the panel script into the new window
        const script = document.createElement('script');
        script.src = chrome.runtime.getURL('src/sidepanel/sidepanel.js');
        script.onload = () => {
            // Initialize the panel
            this.sidePanelWindow.postMessage({
                type: 'INIT_PANEL',
                data: {
                    isRunning: this.isRunning,
                    stats: this.stats,
                    currentJob: this.currentJob
                }
            }, '*');
        };
        this.sidePanelWindow.document.head.appendChild(script);
    }

    bindEvents() {
        // Listen for messages from the side panel
        window.addEventListener('message', (event) => {
            if (event.source !== this.sidePanelWindow) return;
            
            switch (event.data.type) {
                case 'START_PROCESS':
                    this.startProcess(event.data.settings);
                    break;
                case 'STOP_PROCESS':
                    this.stopProcess();
                    break;
                case 'FETCH_DESCRIPTION':
                    this.fetchJobDescription();
                    break;
                case 'OPEN_DESCRIPTION':
                    this.openDescriptionWindow();
                    break;
                case 'SHOW_SAVED':
                    this.showSavedDescriptions();
                    break;
                case 'SAVE_SETTINGS':
                    this.saveSettings(event.data.settings);
                    break;
                case 'LOAD_SETTINGS':
                    this.loadSettings();
                    break;
            }
        });
    }

    async startProcess(settings) {
        if (this.isRunning) return;

        this.isRunning = true;
        this.updatePanelStatus('Starting...');

        try {
            // Send message to background script
            const response = await chrome.runtime.sendMessage({
                action: 'startApplication',
                settings: settings
            });

            if (response.success) {
                this.updatePanelStatus('Running');
                this.startProgressUpdates();
            } else {
                throw new Error(response.error || 'Failed to start process');
            }
        } catch (error) {
            console.error('Error starting process:', error);
            this.showPanelError(error.message);
            this.stopProcess();
        }
    }

    async stopProcess() {
        if (!this.isRunning) return;

        this.isRunning = false;
        this.updatePanelStatus('Stopped');

        try {
            await chrome.runtime.sendMessage({
                action: 'stopApplication'
            });
        } catch (error) {
            console.error('Error stopping process:', error);
        }
    }

    async fetchJobDescription() {
        try {
            this.updatePanelStatus('Fetching job description...');
            
            // Get the active tab
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (!tab.url.includes('linkedin.com/jobs')) {
                this.showPanelError('Please navigate to a LinkedIn job posting page first.');
                return;
            }

            // Inject the description extractor script
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['src/utils/description-extractor.js']
            });

            // Execute the extraction function
            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                function: () => {
                    if (typeof window.extractJobDescription === 'function') {
                        return window.extractJobDescription();
                    } else {
                        throw new Error('Description extractor not loaded');
                    }
                }
            });

            const jobData = results[0].result;
            
            if (jobData && jobData.description) {
                // Store the job data with persistent storage
                await this.saveJobDescription(jobData, tab.url);
                
                this.updatePanelStatus('Job description extracted and saved successfully');
                this.sendToPanel('DESCRIPTION_FETCHED', jobData);
                
            } else {
                throw new Error('Could not extract job description from this page. Please ensure you are on a LinkedIn job posting page.');
            }
            
        } catch (error) {
            console.error('Error fetching job description:', error);
            this.showPanelError(`Failed to fetch job description: ${error.message}`);
        }
    }

    async saveJobDescription(jobData, url) {
        try {
            // Get existing saved descriptions
            const savedDescriptions = await this.getStorageData('savedJobDescriptions') || [];
            
            // Create unique ID for this job
            const jobId = this.generateJobId(jobData.title, jobData.company, url);
            
            // Check if this job is already saved
            const existingIndex = savedDescriptions.findIndex(job => job.id === jobId);
            
            const jobToSave = {
                id: jobId,
                title: jobData.title || 'Unknown Title',
                company: jobData.company || 'Unknown Company',
                location: jobData.location || '',
                salary: jobData.salary || '',
                description: jobData.description,
                requirements: jobData.requirements || [],
                keywords: jobData.keywords || [],
                benefits: jobData.benefits || [],
                jobType: jobData.jobType || '',
                experience: jobData.experience || '',
                url: url,
                savedAt: new Date().toISOString(),
                extractedAt: jobData.extractedAt || new Date().toISOString()
            };
            
            if (existingIndex >= 0) {
                // Update existing entry
                savedDescriptions[existingIndex] = jobToSave;
            } else {
                // Add new entry
                savedDescriptions.unshift(jobToSave);
            }
            
            // Keep only last 50 descriptions
            if (savedDescriptions.length > 50) {
                savedDescriptions.splice(50);
            }
            
            // Save to storage
            await this.setStorageData('savedJobDescriptions', savedDescriptions);
            await this.setStorageData('currentJobData', jobToSave);
            
        } catch (error) {
            console.error('Error saving job description:', error);
            throw error;
        }
    }

    generateJobId(title, company, url) {
        // Use shared JobUtils if available, otherwise fallback to local implementation
        if (typeof JobUtils !== 'undefined' && JobUtils.generateJobId) {
            const baseString = `${title || ''}-${company || ''}-${url || ''}`;
            return JobUtils.generateJobId(baseString);
        }
        
        // Fallback implementation
        const baseString = `${title || ''}-${company || ''}-${url || ''}`;
        return btoa(baseString).replace(/[^a-zA-Z0-9]/g, '').substring(0, 20);
    }

    async openDescriptionWindow() {
        try {
            const jobData = await this.getStorageData('currentJobData');
            
            if (!jobData) {
                this.showPanelError('No job description data available. Please fetch a description first.');
                return;
            }

            // Create a new window with the job description
            const descriptionWindow = window.open('', '_blank', 'width=800,height=700,scrollbars=yes,resizable=yes');
            
            descriptionWindow.document.write(`
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Job Description - ${jobData.title}</title>
                    <style>
                        body {
                            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                            line-height: 1.6;
                            color: #333;
                            max-width: 800px;
                            margin: 0 auto;
                            padding: 20px;
                            background: #f8f9fa;
                        }
                        .header {
                            background: white;
                            padding: 20px;
                            border-radius: 8px;
                            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                            margin-bottom: 20px;
                        }
                        .job-title {
                            font-size: 24px;
                            font-weight: bold;
                            color: #2c3e50;
                            margin-bottom: 10px;
                        }
                        .company-name {
                            font-size: 18px;
                            color: #667eea;
                            margin-bottom: 8px;
                        }
                        .job-meta {
                            display: flex;
                            gap: 20px;
                            flex-wrap: wrap;
                            margin-bottom: 15px;
                            font-size: 14px;
                            color: #666;
                        }
                        .meta-item {
                            display: flex;
                            align-items: center;
                            gap: 5px;
                        }
                        .description {
                            background: white;
                            padding: 25px;
                            border-radius: 8px;
                            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                            white-space: pre-wrap;
                            font-size: 14px;
                            line-height: 1.8;
                        }
                        .keywords {
                            background: white;
                            padding: 20px;
                            border-radius: 8px;
                            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                            margin-top: 20px;
                        }
                        .keyword-tag {
                            display: inline-block;
                            background: #667eea;
                            color: white;
                            padding: 4px 8px;
                            border-radius: 12px;
                            font-size: 12px;
                            margin: 2px;
                        }
                        .requirements {
                            background: white;
                            padding: 20px;
                            border-radius: 8px;
                            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                            margin-top: 20px;
                        }
                        .requirement-item {
                            margin-bottom: 8px;
                            padding-left: 15px;
                            position: relative;
                        }
                        .requirement-item:before {
                            content: "•";
                            position: absolute;
                            left: 0;
                            color: #667eea;
                        }
                        .actions {
                            position: fixed;
                            top: 20px;
                            right: 20px;
                            display: flex;
                            gap: 10px;
                        }
                        .action-btn {
                            padding: 8px 16px;
                            border: none;
                            border-radius: 4px;
                            cursor: pointer;
                            font-size: 12px;
                            font-weight: 500;
                        }
                        .btn-copy {
                            background: #28a745;
                            color: white;
                        }
                        .btn-print {
                            background: #007bff;
                            color: white;
                        }
                        .btn-close {
                            background: #6c757d;
                            color: white;
                        }
                    </style>
                </head>
                <body>
                    <div class="actions">
                        <button class="action-btn btn-copy" onclick="copyDescription()">📋 Copy</button>
                        <button class="action-btn btn-print" onclick="window.print()">🖨️ Print</button>
                        <button class="action-btn btn-close" onclick="window.close()">✕ Close</button>
                    </div>
                    
                    <div class="header">
                        <div class="job-title">${jobData.title}</div>
                        <div class="company-name">${jobData.company}</div>
                        <div class="job-meta">
                            ${jobData.location ? `<div class="meta-item">📍 ${jobData.location}</div>` : ''}
                            ${jobData.salary ? `<div class="meta-item">💰 ${jobData.salary}</div>` : ''}
                            ${jobData.jobType ? `<div class="meta-item">🏢 ${jobData.jobType}</div>` : ''}
                            ${jobData.experience ? `<div class="meta-item">⏰ ${jobData.experience}</div>` : ''}
                        </div>
                    </div>
                    
                    <div class="description">${jobData.description}</div>
                    
                    ${jobData.keywords && jobData.keywords.length > 0 ? `
                        <div class="keywords">
                            <h3>🔑 Key Skills & Technologies</h3>
                            ${jobData.keywords.map(keyword => `<span class="keyword-tag">${keyword}</span>`).join('')}
                        </div>
                    ` : ''}
                    
                    ${jobData.requirements && jobData.requirements.length > 0 ? `
                        <div class="requirements">
                            <h3>📋 Requirements</h3>
                            ${jobData.requirements.map(req => `<div class="requirement-item">${req}</div>`).join('')}
                        </div>
                    ` : ''}
                    
                    <script>
                        function copyDescription() {
                            const description = document.querySelector('.description').textContent;
                            navigator.clipboard.writeText(description).then(() => {
                                alert('Job description copied to clipboard!');
                            });
                        }
                    </script>
                </body>
                </html>
            `);
            
            descriptionWindow.document.close();
            
        } catch (error) {
            console.error('Error opening description window:', error);
            this.showPanelError(`Failed to open description window: ${error.message}`);
        }
    }

    async showSavedDescriptions() {
        try {
            const savedDescriptions = await this.getStorageData('savedJobDescriptions') || [];
            this.sendToPanel('SAVED_DESCRIPTIONS_LOADED', savedDescriptions);
        } catch (error) {
            console.error('Error loading saved descriptions:', error);
            this.showPanelError('Failed to load saved descriptions');
        }
    }

    async loadSettings() {
        try {
            const settings = await this.getStorageData('settings');
            if (settings) {
                this.sendToPanel('SETTINGS_LOADED', settings);
            }
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }

    async saveSettings(settings) {
        try {
            await this.setStorageData('settings', settings);
        } catch (error) {
            console.error('Error saving settings:', error);
        }
    }

    updatePanelStatus(status) {
        this.sendToPanel('STATUS_UPDATE', { status });
    }

    showPanelError(message) {
        this.sendToPanel('ERROR', { message });
    }

    sendToPanel(type, data) {
        if (this.sidePanelWindow && !this.sidePanelWindow.closed) {
            this.sidePanelWindow.postMessage({
                type: type,
                data: data
            }, '*');
        }
    }

    startProgressUpdates() {
        // Listen for messages from background script
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.type === 'progress') {
                this.sendToPanel('PROGRESS_UPDATE', {
                    applied: message.applied || 0,
                    failed: message.failed || 0,
                    total: message.total || 0,
                    percentage: message.percentage || 0
                });
            } else if (message.type === 'currentJob') {
                this.sendToPanel('CURRENT_JOB_UPDATE', { jobTitle: message.jobTitle });
            } else if (message.type === 'error') {
                this.showPanelError(message.error);
            } else if (message.type === 'complete') {
                this.stopProcess();
            }
        });
    }

    async getStorageData(key) {
        try {
            const { StorageUtils } = await import('../utils/shared-utils.js');
            return await StorageUtils.getStorageData(key);
        } catch (error) {
            // Fallback to local implementation
            return new Promise((resolve) => {
                chrome.storage.local.get(key, (result) => {
                    resolve(result[key]);
                });
            });
        }
    }

    async setStorageData(key, value) {
        try {
            const { StorageUtils } = await import('../utils/shared-utils.js');
            return await StorageUtils.setStorageData(key, value);
        } catch (error) {
            // Fallback to local implementation
            return new Promise((resolve) => {
                chrome.storage.local.set({ [key]: value }, resolve);
            });
        }
    }

    cleanup() {
        // Cleanup when window is closed
        this.isRunning = false;
        this.sidePanelWindow = null;
    }
}

// Initialize side panel when script is loaded
new EasyApplySidePanel();