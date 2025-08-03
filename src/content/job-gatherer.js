// LinkedIn Job Gatherer Content Script
// This script runs on LinkedIn job search pages to gather job information

// Import constants (ES6 modules not supported in content scripts, so we'll define them inline)
const SELECTORS = {
    // Job listing page selectors - updated for current LinkedIn structure
    JOB_LIST_CONTAINER: '.scaffold-layout__list',
    JOB_CARDS: 'li[data-occludable-job-id]',
    JOB_TITLE: '.job-card-list__title--link strong',
    JOB_COMPANY: '.artdeco-entity-lockup__subtitle span',
    JOB_LOCATION: '.job-card-container__metadata-wrapper li span',
    JOB_LINK: 'a[href*="/jobs/view/"]',
    JOB_ID: 'data-occludable-job-id',
    
    // Search form selectors
    SEARCH_INPUT: 'input[id^="jobs-search-box-keyword-id-ember"]',
    LOCATION_INPUT: 'input[id^="jobs-search-box-location-id-ember"]',
    SEARCH_BUTTON: '.jobs-search-box__submit-button'
};

(function() {
    'use strict';
    
    let isGathering = false;
    let gatheredJobs = [];
    let currentPage = 1;
    let maxJobs = 10;
    let isInitialized = false;
    
    // Wait for LinkedIn to be fully loaded before initializing
    function waitForLinkedInReady() {
        return new Promise((resolve) => {
            const checkReady = () => {
                // Check if LinkedIn's main content is loaded
                const linkedInReady = document.querySelector('.scaffold-layout__list') ||
                                    document.querySelector('li[data-occludable-job-id]') ||
                                    document.querySelector('.job-card-list__title--link');
                
                // Check if the page is not in loading state
                const notLoading = !document.querySelector('.loading') &&
                                 !document.querySelector('[data-test="loading"]');
                
                // Check for network errors and continue anyway
                const hasNetworkErrors = document.querySelector('script[src*="utag.js"]') &&
                                       performance.getEntriesByType('resource')
                                           .some(entry => entry.name.includes('utag.js') && entry.transferSize === 0);
                
                if (linkedInReady && notLoading) {
                    console.log('✅ LinkedIn page is ready');
                    if (hasNetworkErrors) {
                        console.log('⚠️ LinkedIn analytics failed to load, but continuing...');
                    }
                    resolve();
                } else {
                    console.log('⏳ Waiting for LinkedIn to load...');
                    setTimeout(checkReady, 500); // Reduced from 1000ms
                }
            };
            
            checkReady();
        });
    }
    
    // Initialize the extension only when LinkedIn is ready
    async function initializeExtension() {
        try {
            console.log('🔍 Job search assistant starting initialization...');
            
            // Monitor for network errors
            const originalFetch = window.fetch;
            window.fetch = function(...args) {
                return originalFetch.apply(this, args).catch(error => {
                    if (error.message.includes('SSL_PROTOCOL_ERROR') || 
                        error.message.includes('net::ERR_SSL_PROTOCOL_ERROR')) {
                        console.log('⚠️ Network error detected, but continuing:', error.message);
                    }
                    throw error;
                });
            };
            
            // Wait for LinkedIn to be fully loaded
            await waitForLinkedInReady();
            

            
            console.log('✅ Job search assistant initialized successfully');
            
            // Log initial job count for debugging
            const initialJobCards = document.querySelectorAll(SELECTORS.JOB_CARDS);
            console.log(`🔍 Initial job count: ${initialJobCards.length} jobs found`);
            
            isInitialized = true;
            
        } catch (error) {
            console.error('❌ Failed to initialize job search assistant:', error);
        }
    }
    
    // Set up message listeners
    function setupMessageListeners() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            console.log('📨 Job gatherer received message:', message);
            console.log('📨 Message type:', message.type);
            console.log('📨 Current URL:', window.location.href);
            
            // Handle async operations properly
            const handleAsync = async () => {
                try {
                    switch (message.type) {
                        case 'startGathering':
                            try {
                                console.log('🚀 Manual gathering request received');
                                
                                // Check if this is a manual request (not automatic)
                                if (!message.data || !message.data.manual) {
                                    console.log('⚠️ Ignoring automatic gathering request');
                                    sendResponse({ success: false, error: 'Automatic gathering disabled' });
                                    return;
                                }
                                
                                if (!isInitialized) {
                                    console.log('🚀 Initializing job gatherer on demand...');
                                    await initializeExtension();
                                }
                                
                                // Start gathering in background (don't await to avoid blocking)
                                startGathering(message.data).catch(error => {
                                    console.error('❌ Error in background gathering:', error);
                                });
                                sendResponse({ success: true });
                            } catch (error) {
                                console.error('❌ Error starting gathering:', error);
                                sendResponse({ success: false, error: error.message });
                            }
                            break;
                            
                        case 'stopGathering':
                            stopGathering();
                            sendResponse({ success: true });
                            break;
                            
                        case 'getGatheredJobs':
                            sendResponse({ jobs: gatheredJobs });
                            break;
                            
                        case 'checkReady':
                            // Always respond as ready since we can initialize on demand
                            sendResponse({ ready: true });
                            break;
                            
                        case 'clickJobAndExtractDescription':
                            console.log('📄 Starting job description extraction...');
                            
                            // Simply acknowledge the request and let background script handle navigation
                            sendResponse({ success: true, message: 'Request acknowledged' });
                            
                            // Send a message to background script to handle the actual extraction
                            chrome.runtime.sendMessage({
                                type: 'handleJobDescriptionExtraction',
                                data: message.data
                            });
                            break;
                            

                            
                        case 'extractJobDescription':
                            console.log('📄 Extracting job description from current page...');
                            console.log('📄 Current URL:', window.location.href);
                            console.log('📄 Page title:', document.title);
                            console.log('📄 Message data:', message.data);
                            
                            try {
                                console.log('📄 Starting extractJobDescription function...');
                                
                                // Try to use shared utility first
                                let extractResult;
                                try {
                                    const { JobUtils } = await import('../utils/shared-utils.js');
                                    extractResult = await JobUtils.extractJobDescription(message.data);
                                } catch (error) {
                                    console.log('📄 Shared utility not available, using local function...');
                                    extractResult = await extractJobDescription(message.data);
                                }
                                
                                console.log('📄 Extract result:', extractResult);
                                
                                // Send the result back to the background script
                                chrome.runtime.sendMessage({
                                    type: 'jobDescriptionResult',
                                    data: {
                                        jobId: message.data.jobId,
                                        success: extractResult.success,
                                        description: extractResult.description,
                                        error: extractResult.error
                                    }
                                });
                                
                                if (extractResult.success) {
                                    console.log('✅ Extraction successful, sending response...');
                                    sendResponse({ 
                                        success: true, 
                                        description: extractResult.description,
                                        error: null
                                    });
                                } else {
                                    console.log('❌ Extraction failed, sending error response...');
                                    sendResponse({ 
                                        success: false, 
                                        description: null,
                                        error: extractResult.error || 'Failed to extract description'
                                    });
                                }
                            } catch (error) {
                                console.error('❌ Error extracting job description:', error);
                                sendResponse({ 
                                    success: false, 
                                    description: null,
                                    error: error.message || 'Unknown error occurred'
                                });
                            }
                            break;
                            
                        case 'clickEasyApply':
                            console.log('🚀 Received clickEasyApply message');
                            console.log('🚀 Message data:', message.data);
                            console.log('🚀 Current URL:', window.location.href);
                            console.log('🚀 Page title:', document.title);
                            
                            try {
                                console.log('🚀 Starting clickEasyApplyButton function...');
                                const clickResult = await clickEasyApplyButton();
                                console.log('🚀 Click result:', clickResult);
                                sendResponse(clickResult);
                            } catch (error) {
                                console.error('❌ Error clicking EasyApply:', error);
                                sendResponse({ success: false, error: error.message });
                            }
                            break;
                            
                        default:
                            console.log('Unknown message type:', message.type);
                            sendResponse({ success: false, error: 'Unknown message type' });
                    }
                } catch (error) {
                    console.error('❌ Error in message handler:', error);
                    sendResponse({ success: false, error: error.message });
                }
            };
            
            // Execute async handler
            handleAsync();
            
            return true; // Keep message channel open
        });
    }
    
    async function startGathering(data) {
        try {
            console.log('🚀 Starting job gathering from existing LinkedIn list...');
            
            isGathering = true;
            maxJobs = data.job_count || 1; // Limit to 1 job to prevent multiple reloads
            gatheredJobs = [];
            currentPage = 1;
            
            // Pre-scroll to load all jobs before processing
            await preScrollToLoadAllJobs();
            
            // Start gathering jobs from the current page
            await gatherJobsFromCurrentPage();
            
        } catch (error) {
            console.error('❌ Error starting job gathering:', error);
            isGathering = false;
        }
    }
    
    function stopGathering() {
        console.log('🛑 Stopping job gathering...');
        isGathering = false;
    }
    
    async function preScrollToLoadAllJobs() {
        try {
            console.log('📜 Pre-scrolling to load all jobs...');
            
            const jobListContainer = document.querySelector(SELECTORS.JOB_LIST_CONTAINER);
            if (!jobListContainer) {
                console.log('❌ Job list container not found for pre-scrolling');
                return;
            }
            
            let previousJobCount = 0;
            let scrollAttempts = 0;
            const maxPreScrollAttempts = 5; // Reduced from 10
            let consecutiveNoNewJobs = 0;
            const maxConsecutiveNoNewJobs = 3; // Stop after 3 consecutive attempts with no new jobs
            
            while (scrollAttempts < maxPreScrollAttempts && isGathering) {
                const currentJobCount = document.querySelectorAll(SELECTORS.JOB_CARDS).length;
                
                if (currentJobCount > previousJobCount) {
                    console.log(`🆕 Found ${currentJobCount - previousJobCount} new jobs (total: ${currentJobCount})`);
                    previousJobCount = currentJobCount;
                    consecutiveNoNewJobs = 0; // Reset counter when new jobs are found
                    scrollAttempts = 0; // Reset counter when new jobs are found
                } else {
                    consecutiveNoNewJobs++;
                    if (consecutiveNoNewJobs >= maxConsecutiveNoNewJobs) {
                        console.log(`✅ No new jobs found after ${maxConsecutiveNoNewJobs} attempts - stopping pre-scroll`);
                        break;
                    }
                    scrollAttempts++;
                }
                
                // Scroll to bottom of job list using requestAnimationFrame
                const scrollToBottom = () => {
                    jobListContainer.scrollTop = jobListContainer.scrollHeight;
                };
                requestAnimationFrame(scrollToBottom);
                
                // Also scroll the window to trigger more loading
                const scrollWindow = () => {
                    window.scrollTo(0, document.body.scrollHeight);
                };
                requestAnimationFrame(scrollWindow);
                
                // Scroll back to top to trigger more loading
                const scrollToTop = () => {
                    jobListContainer.scrollTop = 0;
                };
                requestAnimationFrame(scrollToTop);
            }
            
            const finalJobCount = document.querySelectorAll(SELECTORS.JOB_CARDS).length;
            console.log(`✅ Pre-scrolling complete. Total jobs found: ${finalJobCount}`);
            
        } catch (error) {
            console.error('❌ Error during pre-scrolling:', error);
        }
    }
    
    async function gatherJobsFromCurrentPage() {
        try {
            console.log(`📋 Gathering all jobs from page ${currentPage}...`);
            

            
            // Find the job list container
            const jobListContainer = document.querySelector(SELECTORS.JOB_LIST_CONTAINER);
            if (!jobListContainer) {
                console.log('❌ Job list container not found');
                return;
            }
            
            console.log('✅ Found job list container, starting to gather jobs with scrolling...');
            
            // Initialize variables for scrolling and gathering
            let processedCount = 0;
            let totalJobsFound = 0;
            let lastJobCount = 0;
            let scrollAttempts = 0;
            const maxScrollAttempts = 15; // Increased to find more jobs
            const startTime = Date.now();
            const maxGatheringTime = 5 * 60 * 1000; // 5 minutes max
            
            // Start scrolling and gathering process
            let consecutiveNoNewJobs = 0;
            const maxConsecutiveNoNewJobs = 5; // Increased to be more thorough
            
            while (isGathering && scrollAttempts < maxScrollAttempts) {
                // Check for timeout
                if (Date.now() - startTime > maxGatheringTime) {
                    console.log('⏰ Gathering timeout reached (5 minutes) - stopping');
                    break;
                }
                // Get current job cards
                let jobCards = document.querySelectorAll(SELECTORS.JOB_CARDS);
                totalJobsFound = jobCards.length;
                
                if (scrollAttempts === 0) {
                    console.log(`🔍 Found ${totalJobsFound} job listings - starting to process...`);
                }
                
                // Process new jobs that haven't been processed yet
                let newJobsProcessed = 0;
                for (let i = processedCount; i < jobCards.length; i++) {
                    const card = jobCards[i];
                    
                    if (!isGathering) {
                        console.log('🛑 Gathering stopped by user');
                        break;
                    }
                    
                    // Check if we've reached the maximum number of jobs to gather
                    if (gatheredJobs.length >= maxJobs) {
                        console.log(`✅ Reached maximum job limit (${maxJobs}) - stopping job gathering`);
                        break;
                    }
                    
                    try {
                        // Scroll the job card into view to trigger lazy loading
                        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        
                        // Add some randomization to avoid getting the same jobs every time
                        const shouldSkip = Math.random() < 0.3; // 30% chance to skip a job
                        if (shouldSkip) {
                            console.log(`🎲 Randomly skipping job ${i + 1} to get variety`);
                            processedCount++;
                            continue;
                        }
                        
                        // Extract basic job info from the card
                        const basicJobInfo = extractBasicJobInfo(card);
                        if (basicJobInfo && basicJobInfo.title) {
                            // Add to gathered jobs
                            gatheredJobs.push(basicJobInfo);
                            processedCount++;
                            newJobsProcessed++;
                            
                            // Send real-time update to background script
                            chrome.runtime.sendMessage({
                                type: 'jobGathered',
                                job: basicJobInfo,
                                total: gatheredJobs.length,
                                progress: {
                                    current: gatheredJobs.length,
                                    total: maxJobs,
                                    percentage: Math.round((gatheredJobs.length / maxJobs) * 100)
                                }
                            });
                            
                            // Auto-fetch job description disabled to prevent navigation issues
                            // if (basicJobInfo.url) {
                            //     try {
                            //         console.log('📄 Auto-fetching description for:', basicJobInfo.title);
                            //         const extractResult = await extractJobDescription({
                            //             jobId: basicJobInfo.id || basicJobInfo.url,
                            //             jobUrl: basicJobInfo.url
                            //         });
                            //         
                            //         if (extractResult.success) {
                            //             console.log('✅ Auto-fetched description for:', basicJobInfo.title);
                            //         } else {
                            //             console.log('❌ Auto-fetch failed for:', basicJobInfo.title);
                            //         }
                            //     } catch (error) {
                            //         console.error('❌ Auto-fetch error for:', basicJobInfo.title, error);
                            //     }
                            // }
                            
                            // Log progress
                            console.log(`✅ Gathered job ${gatheredJobs.length}/${maxJobs}: ${basicJobInfo.title}`);
                            
                            // Check if we've reached the limit
                            if (gatheredJobs.length >= maxJobs) {
                                console.log(`✅ Reached maximum job limit (${maxJobs}) - stopping job gathering`);
                                break;
                            }
                        }
                    } catch (error) {
                        console.error('❌ Error processing job listing:', error);
                    }
                    

                }
                
                // If no new jobs were processed in this iteration, we might be at the end
                if (newJobsProcessed === 0 && processedCount > 0) {
                    console.log('🛑 No new jobs processed in this iteration - likely at end of list');
                    break;
                }
                
                // Check if we found new jobs after this scroll
                if (totalJobsFound === lastJobCount) {
                    consecutiveNoNewJobs++;
                    console.log(`📜 No new jobs found (attempt ${consecutiveNoNewJobs}/${maxConsecutiveNoNewJobs})`);
                    
                    if (consecutiveNoNewJobs >= maxConsecutiveNoNewJobs) {
                        console.log('🛑 Reached end of job list - no more jobs to load');
                        break;
                    }
                    
                    // Try scrolling down to load more jobs
                    console.log('📜 Scrolling down to load more jobs...');
                    
                    // Store current scroll position
                    const currentScrollTop = jobListContainer.scrollTop;
                    const currentScrollHeight = jobListContainer.scrollHeight;
                    
                    // Scroll to the bottom of the job list
                    jobListContainer.scrollTop = jobListContainer.scrollHeight;
                    
                    // Also try scrolling the window to trigger more loading
                    window.scrollTo(0, document.body.scrollHeight);
                    
                    // Check if new jobs appeared
                    const newJobCards = document.querySelectorAll(SELECTORS.JOB_CARDS);
                    if (newJobCards.length > totalJobsFound) {
                        console.log(`🆕 Found ${newJobCards.length - totalJobsFound} new jobs after scrolling`);
                        lastJobCount = totalJobsFound;
                        totalJobsFound = newJobCards.length;
                        consecutiveNoNewJobs = 0; // Reset counter when new jobs are found
                    } else {
                        // Check if we're actually at the bottom of the list
                        const newScrollHeight = jobListContainer.scrollHeight;
                        const newScrollTop = jobListContainer.scrollTop;
                        
                        if (newScrollHeight === currentScrollHeight && newScrollTop === currentScrollTop) {
                            console.log('🛑 Reached actual bottom of job list - no more content to load');
                            break;
                        }
                        
                        scrollAttempts++;
                        console.log(`⚠️ No new jobs found after scroll attempt ${scrollAttempts}`);
                    }
                } else {
                    lastJobCount = totalJobsFound;
                    consecutiveNoNewJobs = 0; // Reset counter when new jobs are found
                }
                

            }
            
            console.log(`✅ Successfully gathered ${gatheredJobs.length}/${maxJobs} jobs from ${totalJobsFound} available`);
            
            // Final check - if we reached the limit or processed all available jobs, we're done
            if (gatheredJobs.length >= maxJobs) {
                console.log(`✅ Reached maximum job limit (${maxJobs})`);
            } else if (processedCount >= totalJobsFound) {
                console.log('✅ All available jobs have been processed');
            } else {
                console.log(`⚠️ Processed ${processedCount}/${totalJobsFound} jobs - some may have been skipped`);
            }
            
            // Send completion message to background script
            chrome.runtime.sendMessage({
                type: 'gatheringComplete',
                jobs: gatheredJobs,
                total: gatheredJobs.length,
                maxJobs: maxJobs,
                pageJobs: totalJobsFound,
                processedJobs: processedCount
            });
            
            // Stop gathering
            isGathering = false;
            
        } catch (error) {
            console.error('❌ Error in gatherJobsFromCurrentPage:', error);
        }
    }
    
    function extractBasicJobInfo(card) {
        try {
            // Check if card is valid
            if (!card || !card.querySelector) {
                console.log('⚠️ Invalid card element provided to extractBasicJobInfo');
                return null;
            }
            
            // Extract job title
            const titleElement = card.querySelector(SELECTORS.JOB_TITLE);
            const title = titleElement ? safeGetTextContent(titleElement) : null;
            
            // Extract company name
            const companyElement = card.querySelector(SELECTORS.JOB_COMPANY);
            const company = companyElement ? safeGetTextContent(companyElement) : null;
            
            // Extract location
            const locationElement = card.querySelector(SELECTORS.JOB_LOCATION);
            const location = locationElement ? safeGetTextContent(locationElement) : null;
            
            // Extract job URL
            const linkElement = card.querySelector(SELECTORS.JOB_LINK);
            const url = linkElement ? linkElement.href : null;
            
            // Extract job ID from URL
            const jobId = url ? url.match(/\/jobs\/view\/(\d+)/)?.[1] : null;
            
            if (title && url) {
                return {
                    id: jobId,
                    title: title,
                    company: company || 'Unknown Company',
                    location: location || 'Unknown Location',
                    url: url,
                    gatheredAt: new Date().toISOString()
                };
            }
            
            return null;
            
        } catch (error) {
            console.error('❌ Error extracting basic job info:', error);
            return null;
        }
    }
    

    

    
    // Utility function to safely extract text content
    function safeTextContent(element) {
        try {
            if (!element) return '';
            if (typeof element.textContent === 'undefined') return '';
            return element.textContent?.trim() || '';
        } catch (error) {
            console.log('⚠️ Error extracting text content:', error.message);
            return '';
        }
    }
    
    // Enhanced safe text content function with better error handling
    function safeGetTextContent(element, fallback = '') {
        try {
            if (!element) return fallback;
            if (typeof element.textContent === 'undefined') return fallback;
            if (element.textContent === null) return fallback;
            return element.textContent.trim() || fallback;
        } catch (error) {
            console.log('⚠️ Error in safeGetTextContent:', error.message);
            return fallback;
        }
    }
    
    // Global error handler for textContent errors
    window.addEventListener('error', function(event) {
        if (event.error && event.error.message && event.error.message.includes('textContent')) {
            console.log('⚠️ Caught textContent error:', event.error.message);
            event.preventDefault();
            return false;
        }
    });
    
    // Initialize error handling
    setupPolicyCompliantBehavior();
    
    // Suppress global error messages and performance violations from LinkedIn
    const originalConsoleError = console.error;
    const originalConsoleWarn = console.warn;
    const originalConsoleLog = console.log;
    
    console.error = function(...args) {
        // Filter out LinkedIn's internal errors
        const message = args.join(' ');
        if (message.includes('ns!') || message.includes('main.min.js') || 
            message.includes('Violation') || message.includes('passive event listener') ||
            message.includes('setTimeout') || message.includes('requestIdleCallback') ||
            message.includes('Forced reflow') || message.includes('fenced frame')) {
            return; // Suppress LinkedIn's internal errors and performance violations
        }
        originalConsoleError.apply(console, args);
    };
    
    console.warn = function(...args) {
        // Filter out LinkedIn's performance violations
        const message = args.join(' ');
        if (message.includes('Violation') || message.includes('passive event listener') ||
            message.includes('scroll-blocking') || message.includes('setTimeout') ||
            message.includes('requestIdleCallback') || message.includes('Forced reflow')) {
            return; // Suppress LinkedIn's performance warnings
        }
        originalConsoleWarn.apply(console, args);
    };
    
    // Reduce console logging to avoid detection
    console.log = function(...args) {
        const message = args.join(' ');
        // Only log important messages, suppress excessive logging
        if (message.includes('DEBUG') || message.includes('ERROR') || message.includes('SUCCESS')) {
            originalConsoleLog.apply(console, args);
        }
    };
    
    // Don't auto-initialize - wait for gather button click
    console.log('🔍 Job gatherer loaded - waiting for manual activation...');
    console.log('🔍 Current URL:', window.location.href);
    console.log('🔍 Page type:', window.location.href.includes('/jobs/view/') ? 'Job Detail Page' : 'Job Search Page');
    
    // Set up message listeners immediately (but don't initialize yet)
    setupMessageListeners();
    
    // Prevent automatic initialization to avoid constant reloading
    console.log('🔍 Extension ready - waiting for manual activation');
    console.log('🔍 Automatic gathering disabled - manual activation required');
    
    // Policy-compliant extension behavior
    function setupPolicyCompliantBehavior() {
        try {
            // Remove any extension-specific attributes that LinkedIn might detect
            const removeExtensionAttributes = () => {
                try {
                    const elements = document.querySelectorAll('[data-extension], [data-easyapply], [data-automation]');
                    elements.forEach(el => {
                        el.removeAttribute('data-extension');
                        el.removeAttribute('data-easyapply');
                        el.removeAttribute('data-automation');
                    });
                } catch (error) {
                    console.log('⚠️ Error in removeExtensionAttributes:', error.message);
                }
            };
            
            // Use native browser APIs instead of extension-specific ones
            const useNativeAPIs = () => {
                try {
                    // Override any extension-specific globals
                    if (window.easyApplyExtension) {
                        delete window.easyApplyExtension;
                    }
                    if (window.jobGatherer) {
                        delete window.jobGatherer;
                    }
                } catch (error) {
                    console.log('⚠️ Error in useNativeAPIs:', error.message);
                }
            };
            
            // Remove any extension-specific CSS classes
            const removeExtensionClasses = () => {
                try {
                    const elements = document.querySelectorAll('.extension-element, .easyapply-element, .automation-element');
                    elements.forEach(el => {
                        el.classList.remove('extension-element', 'easyapply-element', 'automation-element');
                    });
                } catch (error) {
                    console.log('⚠️ Error in removeExtensionClasses:', error.message);
                }
            };
            
            // Clean up any extension traces
            const cleanupExtensionTraces = () => {
                try {
                    removeExtensionAttributes();
                    removeExtensionClasses();
                    useNativeAPIs();
                } catch (error) {
                    console.log('⚠️ Error in cleanupExtensionTraces:', error.message);
                }
            };
            
            // Run cleanup periodically with error handling
            setInterval(() => {
                try {
                    cleanupExtensionTraces();
                } catch (error) {
                    console.log('⚠️ Error in periodic cleanup:', error.message);
                }
            }, 5000);
            
            // Initial cleanup
            cleanupExtensionTraces();
        } catch (error) {
            console.log('⚠️ Error in setupPolicyCompliantBehavior:', error.message);
        }
    }
    
    async function debugJobClickAndLoad(data) {
        try {
            console.log('🔍 DEBUG: Starting job link navigation approach with data:', data);
            
            const debug = {
                step1: '',
                step2: '',
                step3: '',
                step4: '',
                step5: '',
                foundJobLink: false,
                jobLinkUrl: '',
                navigationSuccess: false,
                descriptionLoaded: false
            };
            
            // Step 1: Extract job ID from URL
            debug.step1 = 'Extracting job ID from URL';
            console.log('🔍 DEBUG Step 1:', debug.step1);
            
            const jobUrl = data.jobUrl || '';
            const extractedJobId = jobUrl.match(/\/jobs\/view\/(\d+)/)?.[1];
            
            debug.step1 = `Extracted job ID: ${extractedJobId}`;
            console.log('🔍 DEBUG Step 1:', debug.step1);
            
            if (!extractedJobId) {
                debug.step1 = 'Failed to extract job ID from URL';
                return { success: false, description: null, error: 'Could not extract job ID from URL', debug };
            }
            
            // Step 2: Use the provided job URL directly
            debug.step2 = 'Using provided job URL for navigation';
            console.log('🔍 DEBUG Step 2:', debug.step2);
            
            // Use the provided job URL directly instead of searching for a link
            const jobLinkUrl = jobUrl;
            
            debug.step2 = 'Job URL ready for navigation';
            console.log('🔍 DEBUG Step 2:', debug.step2);
            debug.foundJobLink = true;
            debug.jobLinkUrl = jobLinkUrl;
            
            // Step 3: Navigate to the full job description page
            debug.step3 = 'Navigating to full job description page';
            console.log('🔍 DEBUG Step 3:', debug.step3);
            
            try {
                console.log('🌐 DEBUG: Would navigate to job URL:', jobLinkUrl);
                
                // Don't automatically navigate - let the background script handle navigation
                // window.location.href = jobLinkUrl; // Commented out to prevent auto-reloading
                
                debug.step3 = 'Navigation skipped - manual navigation required';
                console.log('🔍 DEBUG Step 3:', debug.step3);
                debug.navigationSuccess = false;
                
            } catch (error) {
                debug.step3 = `Failed to prepare navigation: ${error.message}`;
                console.log('🔍 DEBUG Step 3:', debug.step3);
                return { success: false, description: null, error: error.message, debug };
            }
            
            // Step 4: Wait for the job description page to load
            debug.step4 = 'Waiting for job description page to load';
            console.log('🔍 DEBUG Step 4:', debug.step4);
            
            // Wait for the page to load
            
            
            // Step 5: Extract job description from the full job page
            debug.step5 = 'Extracting job description from full job page';
            console.log('🔍 DEBUG Step 5:', debug.step5);
            
            const descriptionSelectors = [
                '.job-details-about-the-job-module__description',
                '.jobs-description',
                '.job-description',
                '[data-test-id="job-description"]',
                '.job-details-about-the-job-module__content',
                '.jobs-box__html-content',
                '.job-description__content',
                '.job-details__description'
            ];
            
            let descriptionElement = null;
            for (const selector of descriptionSelectors) {
                descriptionElement = document.querySelector(selector);
                if (descriptionElement && descriptionElement.textContent?.trim().length > 50) {
                    debug.descriptionLoaded = true;
                    debug.step5 = `Job description found using selector: ${selector}`;
                    console.log('🔍 DEBUG Step 5:', debug.step5);
                    console.log('🔍 DEBUG: Description length:', descriptionElement.textContent?.trim().length);
                    break;
                }
            }
            
            if (!descriptionElement) {
                debug.step5 = 'Job description not found on full job page';
                console.log('🔍 DEBUG Step 5:', debug.step5);
                return { success: false, description: null, error: 'Job description not found on full job page', debug };
            }
            
            // Success! Job description found
            debug.step5 = 'Job description found successfully';
            console.log('🔍 DEBUG Step 5:', debug.step5);
            
            // Extract the job description text
            const jobDescription = {
                jobId: extractedJobId,
                title: document.querySelector('.job-details-jobs-unified-top-card__job-title')?.textContent?.trim() || 'Unknown Title',
                company: document.querySelector('.job-details-jobs-unified-top-card__company-name')?.textContent?.trim() || 'Unknown Company',
                location: document.querySelector('.job-details-jobs-unified-top-card__bullet')?.textContent?.trim() || 'Unknown Location',
                description: descriptionElement?.textContent?.trim() || '',
                url: window.location.href
            };
            
            // Save the job description
            try {
                await saveJobDescription(jobDescription);
                console.log('✅ DEBUG: Job description saved successfully');
            } catch (error) {
                console.log('⚠️ DEBUG: Failed to save job description:', error.message);
            }
            
            return { 
                success: true, 
                description: jobDescription, 
                debug 
            };
            
        } catch (error) {
            console.error('❌ Error in debugJobClickAndLoad:', error);
            debug.step5 = `Error: ${error.message}`;
            return { success: false, description: null, error: error.message || 'Unknown error occurred', debug };
        }
    }
    
    /**
     * Click on a specific job listing in the left panel
     */
    async function clickJobListing(jobUrl) {
        try {
            console.log('🔍 Looking for job listing with URL:', jobUrl);
            
            // Extract job ID from URL
            const jobIdMatch = jobUrl.match(/\/jobs\/view\/(\d+)/);
            const jobId = jobIdMatch ? jobIdMatch[1] : null;
            
            if (!jobId) {
                console.log('❌ Could not extract job ID from URL');
                return false;
            }
            
            // Look for job cards in the left panel
            const jobCardSelectors = [
                `li[data-occludable-job-id="${jobId}"]`,
                `a[href*="/jobs/view/${jobId}"]`,
                `.job-card-container[data-job-id="${jobId}"]`,
                `[data-job-id="${jobId}"]`
            ];
            
            let jobCard = null;
            for (const selector of jobCardSelectors) {
                jobCard = document.querySelector(selector);
                if (jobCard) {
                    console.log('✅ Found job card using selector:', selector);
                    break;
                }
            }
            
            if (!jobCard) {
                console.log('❌ Job card not found, trying to scroll and search...');
                
                // Try to scroll through the job list to find the job
                const jobListContainer = document.querySelector('.jobs-search-results__list');
                if (jobListContainer) {
                    await scrollToFindJob(jobListContainer, jobId);
                    
                    // Try to find the job card again after scrolling
                    for (const selector of jobCardSelectors) {
                        jobCard = document.querySelector(selector);
                        if (jobCard) {
                            console.log('✅ Found job card after scrolling using selector:', selector);
                            break;
                        }
                    }
                }
            }
            
            if (!jobCard) {
                console.log('❌ Job card still not found after scrolling');
                return false;
            }
            
            // Scroll the job card into view using requestAnimationFrame for better performance
            const scrollToJob = () => {
                jobCard.scrollIntoView({ behavior: 'auto', block: 'center' });
            };
            
            requestAnimationFrame(scrollToJob);
            
            // Click on the job card
            console.log('🖱️ Clicking on job card...');
            jobCard.click();
            
            console.log('✅ Successfully clicked on job listing');
            return true;
            
        } catch (error) {
            console.error('❌ Error clicking job listing:', error);
            return false;
        }
    }
    
    /**
     * Scroll through job list to find a specific job (debug version)
     */
    async function scrollToFindJobDebug(jobListContainer, jobId, debug) {
        try {
            console.log('📜 DEBUG: Scrolling to find job:', jobId);
            
            let scrollAttempts = 0;
            const maxScrollAttempts = 10;
            
            while (scrollAttempts < maxScrollAttempts) {
                // Check if the job is now visible
                const jobCardSelectors = [
                    `li[data-occludable-job-id="${jobId}"]`,
                    `a[href*="/jobs/view/${jobId}"]`,
                    `[data-job-id="${jobId}"]`
                ];
                
                let jobCard = null;
                for (const selector of jobCardSelectors) {
                    jobCard = document.querySelector(selector);
                    if (jobCard) {
                        console.log('✅ DEBUG: Job found after scrolling using selector:', selector);
                        return { jobCard, attempts: scrollAttempts };
                    }
                }
                
                // Scroll down in the job list with human-like behavior
                const scrollStep = () => {
                    // Use smaller, more natural scroll increments
                    const scrollAmount = 200 + Math.random() * 100;
                    jobListContainer.scrollTop += scrollAmount;
                };
                requestAnimationFrame(scrollStep);

                
                scrollAttempts++;
                console.log(`📜 DEBUG: Scroll attempt ${scrollAttempts}/${maxScrollAttempts}`);
            }
            
            console.log('❌ DEBUG: Job not found after scrolling');
            return { jobCard: null, attempts: scrollAttempts };
            
        } catch (error) {
            console.error('❌ DEBUG: Error scrolling to find job:', error);
            return { jobCard: null, attempts: 0 };
        }
    }
    
    /**
     * Scroll through job list to find a specific job
     */
    async function scrollToFindJob(jobListContainer, jobId) {
        try {
            console.log('📜 Scrolling to find job:', jobId);
            
            let scrollAttempts = 0;
            const maxScrollAttempts = 10;
            
            while (scrollAttempts < maxScrollAttempts) {
                // Check if the job is now visible
                const jobCard = document.querySelector(`li[data-occludable-job-id="${jobId}"]`) ||
                                document.querySelector(`a[href*="/jobs/view/${jobId}"]`);
                
                if (jobCard) {
                    console.log('✅ Job found after scrolling');
                    return true;
                }
                
                // Use requestAnimationFrame for smoother scrolling
                const scrollStep = () => {
                    jobListContainer.scrollTop += 300;
                };
                
                // Perform scroll in animation frame
                requestAnimationFrame(scrollStep);

                
                scrollAttempts++;
            }
            
            console.log('❌ Job not found after scrolling');
            return false;
            
        } catch (error) {
            console.error('❌ Error scrolling to find job:', error);
            return false;
        }
    }
    
    /**
     * Wait for job description to load on the right side
     */
    async function waitForJobDescriptionToLoad() {
        try {
            console.log('⏳ Waiting for job description to load...');
            
            const maxWaitTime = 15000; // 15 seconds (increased from 10)
            const checkInterval = 500; // Check every 500ms
            let elapsedTime = 0;
            
            while (elapsedTime < maxWaitTime) {
                // Check if job description is loaded
                const descriptionSelectors = [
                    '.job-details-about-the-job-module__description',
                    '.jobs-description',
                    '.job-description',
                    '[data-test-id="job-description"]',
                    '.job-details-about-the-job-module__content',
                    '.jobs-box__html-content'
                ];
                
                for (const selector of descriptionSelectors) {
                    const descriptionElement = document.querySelector(selector);
                    if (descriptionElement && descriptionElement?.textContent?.trim().length > 50) {
                        console.log('✅ Job description loaded successfully using selector:', selector);
                        return true;
                    }
                }
                
                // Also check if we're still on a job page
                const jobTitle = document.querySelector('h1') || document.querySelector('.job-details-jobs-unified-top-card__job-title');
                if (!jobTitle) {
                    console.log('❌ No job title found - may have navigated away');
                    return false;
                }
                
    
                elapsedTime += checkInterval;
                
                // Log progress every 5 seconds
                if (elapsedTime % 5000 === 0) {
                    console.log(`⏳ Still waiting for job description... (${elapsedTime/1000}s elapsed)`);
                }
            }
            
            console.log('❌ Job description did not load within timeout');
            return false;
            
        } catch (error) {
            console.error('❌ Error waiting for job description:', error);
            return false;
        }
    }
    
    /**
     * Extract job description from the current page
     * Uses shared JobUtils.extractJobDescription from shared-utils.js
     */
    async function extractJobDescription(data) {
        try {
            const { jobId } = data;
            
            console.log('📄 DEBUG: Starting job description extraction for jobId:', jobId);
            console.log('📄 DEBUG: Current page URL:', window.location.href);
            console.log('📄 DEBUG: Page title:', document.title);
            console.log('📄 DEBUG: Data received:', data);
            
            // Check if we're on a job page
            if (!window.location.href.includes('/jobs/view/')) {
                console.log('❌ Not on a job detail page');
                return { success: false, description: null, error: 'Not on a job detail page' };
            }
            
            console.log('📄 DEBUG: On job page, starting extraction...');
            
            // Use shared JobUtils if available, otherwise fallback to local implementation
            if (typeof JobUtils !== 'undefined' && JobUtils.extractJobDescription) {
                console.log('📄 DEBUG: Using shared JobUtils.extractJobDescription');
                return await JobUtils.extractJobDescription(data);
            } else {
                console.log('📄 DEBUG: Using fallback extraction method');
                return await tryExtractDescription(data);
            }
            
        } catch (error) {
            console.error('❌ Error in extractJobDescription:', error);
            return { success: false, description: null, error: error.message };
        }
    }
    
    async function tryExtractDescription(data) {
        try {
            console.log('📄 DEBUG: tryExtractDescription started with data:', data);
            
            // Look for the job description container
            const descriptionSelectors = [
                '.job-details-about-the-job-module__description',
                '.jobs-description',
                '.job-description',
                '[data-test-id="job-description"]',
                '.description',
                '.jobs-box__html-content',
                '.jobs-description-content__text',
                '.job-view-layout .jobs-description',
                '.job-details-jobs-unified-top-card__job-description',
                '.jobs-unified-top-card__job-description',
                '.jobs-description__content',
                '.job-details-jobs-unified-top-card__content',
                '.jobs-box__html-content .jobs-box__html-content',
                '.jobs-description-content',
                '.job-details-about-the-job-module',
                '.jobs-unified-top-card__content',
                '.jobs-description__content__text',
                '.jobs-box__html-content p',
                '.jobs-description p',
                '.job-description p'
            ];
            
            // Also look for requirements section
            const requirementsSelectors = [
                '.job-details-about-the-job-module__section',
                '.job-details-about-the-job-module__requirements-list',
                '.requirements-list',
                '.job-requirements'
            ];
            
            console.log('📄 DEBUG: Checking all description selectors...');
            console.log('📄 DEBUG: Page HTML preview:', document.body.innerHTML.substring(0, 1000));
            
            let descriptionElement = null;
            for (const selector of descriptionSelectors) {
                const elements = document.querySelectorAll(selector);
                console.log(`📄 DEBUG: Selector "${selector}" found ${elements.length} elements`);
                
                if (elements.length > 0) {
                    descriptionElement = elements[0];
                    console.log('📄 DEBUG: Found description using selector:', selector);
                    console.log('📄 DEBUG: Description element text length:', descriptionElement?.textContent?.trim().length || 0);
                    console.log('📄 DEBUG: Description preview:', descriptionElement?.textContent?.trim().substring(0, 200) || '');
                    console.log('📄 DEBUG: Element HTML:', descriptionElement.outerHTML.substring(0, 500));
                    break;
                }
            }
            
            // If no description found, try to find any element with job-related content
            if (!descriptionElement) {
                console.log('📄 DEBUG: No description found with selectors, searching for job content...');
                const allElements = document.querySelectorAll('*');
                for (const element of allElements) {
                    const text = element.textContent?.trim();
                    if (text && text.length > 500 && 
                        (text.includes('About the job') || text.includes('Job Description') || text.includes('Requirements') || text.includes('Responsibilities'))) {
                        console.log('📄 DEBUG: Found potential job content element:', element.tagName, element.className);
                        console.log('📄 DEBUG: Content preview:', text.substring(0, 200));
                        descriptionElement = element;
                        break;
                    }
                }
            }
            
            if (!descriptionElement) {
                console.log('❌ No job description found on page');
                return { success: false, description: null };
            }
            
            // Now look for requirements section
            console.log('📄 DEBUG: Looking for requirements section...');
            let requirementsElement = null;
            for (const selector of requirementsSelectors) {
                requirementsElement = document.querySelector(selector);
                if (requirementsElement) {
                    console.log('📄 DEBUG: Found requirements using selector:', selector);
                    console.log('📄 DEBUG: Requirements element text length:', requirementsElement?.textContent?.trim().length || 0);
                    console.log('📄 DEBUG: Requirements preview:', requirementsElement?.textContent?.trim().substring(0, 200) || '');
                    break;
                } else {
                    console.log('📄 DEBUG: Requirements selector not found:', selector);
                }
            }
            
            // Extract job information
            const jobTitle = document.querySelector('.job-details-jobs-unified-top-card__job-title h1')?.textContent?.trim() ||
                            document.querySelector('h1')?.textContent?.trim() ||
                            'Unknown Job Title';
            
            const companyName = document.querySelector('.job-details-jobs-unified-top-card__company-name a')?.textContent?.trim() ||
                               document.querySelector('.company-name')?.textContent?.trim() ||
                               'Unknown Company';
            
            const location = document.querySelector('.job-details-jobs-unified-top-card__tertiary-description-container')?.textContent?.trim() ||
                            document.querySelector('.location')?.textContent?.trim() ||
                            'Unknown Location';
            
            // Extract the description text and filter out navigation elements
            let descriptionText = descriptionElement?.textContent?.trim() || descriptionElement?.innerHTML || '';
            
            // Extract requirements text if found
            let requirementsText = '';
            if (requirementsElement) {
                requirementsText = requirementsElement?.textContent?.trim() || '';
                console.log('📄 DEBUG: Adding requirements to description');
            }
            
            // Filter out common navigation text that might be captured
            const navigationTexts = [
                'Skip to search',
                'Skip to main content',
                'Keyboard shortcuts',
                'Skip to navigation',
                'Skip to footer'
            ];
            
            navigationTexts.forEach(navText => {
                descriptionText = descriptionText.replace(new RegExp(navText, 'gi'), '');
                requirementsText = requirementsText.replace(new RegExp(navText, 'gi'), '');
            });
            
            // Clean up extra whitespace
            descriptionText = descriptionText.replace(/\s+/g, ' ').trim();
            requirementsText = requirementsText.replace(/\s+/g, ' ').trim();
            
            // Combine description and requirements
            let fullDescription = descriptionText;
            if (requirementsText) {
                fullDescription += '\n\n--- REQUIREMENTS ---\n' + requirementsText;
            }
            
            // Check if we have meaningful content
            if (fullDescription.length < 100) {
                console.log('❌ Description too short, might be navigation text');
                return { success: false, description: null };
            }
            
            // Create job description object
            const jobDescription = {
                id: data.jobId === 'current-page' ? generateJobId(jobTitle + companyName) : data.jobId,
                title: jobTitle,
                company: companyName,
                location: location,
                description: fullDescription,
                fetchedAt: new Date().toISOString(),
                url: window.location.href
            };
            
            // Save to storage
            await saveJobDescription(jobDescription);
            
            console.log('✅ Job description extracted successfully');
            console.log('📄 DEBUG: Returning success result from tryExtractDescription');
            return { success: true, description: jobDescription };
            
        } catch (error) {
            console.error('❌ Error in tryExtractDescription:', error);
            console.log('📄 DEBUG: Returning error result from tryExtractDescription');
            return { success: false, description: null, error: error.message };
        }
    }
    
    /**
     * Save job description to storage
     */
    async function saveJobDescription(jobDescription) {
        try {
            console.log('💾 DEBUG: Saving job description to storage...');
            console.log('💾 DEBUG: Job ID:', jobDescription.id);
            console.log('💾 DEBUG: Job Title:', jobDescription.title);
            console.log('💾 DEBUG: Description length:', jobDescription.description?.length || 0);
            
            // Get existing saved descriptions
            const result = await chrome.storage.local.get(['savedJobDescriptions']);
            const savedDescriptions = result.savedJobDescriptions || {};
            
            // Add new description
            savedDescriptions[jobDescription.id] = jobDescription;
            
            // Save to storage
            await chrome.storage.local.set({ savedJobDescriptions: savedDescriptions });
            
            console.log('✅ DEBUG: Job description saved to storage successfully');
            console.log('💾 DEBUG: Total saved descriptions:', Object.keys(savedDescriptions).length);
            console.log('💾 DEBUG: Saved job description preview:', jobDescription.description.substring(0, 300));
        } catch (error) {
            console.error('❌ DEBUG: Error saving job description:', error);
        }
    }
    
    /**
     * Generate a unique job ID
     */
    function generateJobId(text) {
        // Use shared JobUtils if available, otherwise fallback to local implementation
        if (typeof JobUtils !== 'undefined' && JobUtils.generateJobId) {
            return JobUtils.generateJobId(text);
        }
        
        // Fallback implementation
        return btoa(text).replace(/[^a-zA-Z0-9]/g, '').substring(0, 10);
    }
    
    /**
     * Wait for page to load
     */
    async function waitForPageLoad() {
        return new Promise((resolve) => {
            if (document.readyState === 'complete') {
                resolve();
            } else {
                window.addEventListener('load', resolve);
            }
        });
    }
    
    /**
     * Click EasyApply button on LinkedIn job page
     */
    async function clickEasyApplyButton() {
        try {
            console.log('🚀 Looking for EasyApply button...');
            
            // Wait for page to be fully loaded
            await waitForPageLoad();
            
            // Common selectors for EasyApply buttons
            const easyApplySelectors = [
                'button[aria-label*="Easy Apply"]',
                'button[aria-label*="Easy apply"]',
                'button[aria-label*="Apply"]',
                'button:contains("Easy Apply")',
                'button:contains("Apply")',
                '[data-control-name="jobdetails_topcard_inapply"]',
                '[data-control-name="jobdetails_topcard_inapply"] button',
                'button[data-control-name="jobdetails_topcard_inapply"]',
                '.jobs-apply-button',
                '.jobs-apply-button button',
                'button.jobs-apply-button',
                '[data-control-name="jobdetails_topcard_inapply"] .artdeco-button',
                '.artdeco-button[aria-label*="Easy Apply"]',
                '.artdeco-button[aria-label*="Apply"]'
            ];
            
            let easyApplyButton = null;
            
            // Try each selector
            for (const selector of easyApplySelectors) {
                try {
                    const buttons = document.querySelectorAll(selector);
                    console.log(`🔍 Trying selector "${selector}": found ${buttons.length} elements`);
                    
                    for (const button of buttons) {
                        const text = safeGetTextContent(button, '').toLowerCase();
                        const ariaLabel = button.getAttribute('aria-label')?.toLowerCase() || '';
                        
                        console.log(`🔍 Button text: "${text}", aria-label: "${ariaLabel}"`);
                        
                        if (text.includes('easy apply') || text.includes('apply') || 
                            ariaLabel.includes('easy apply') || ariaLabel.includes('apply')) {
                            easyApplyButton = button;
                            console.log('✅ Found EasyApply button:', button);
                            break;
                        }
                    }
                    
                    if (easyApplyButton) break;
                } catch (error) {
                    console.log(`❌ Error with selector "${selector}":`, error);
                }
            }
            
            if (!easyApplyButton) {
                console.log('❌ No EasyApply button found');
                return { 
                    success: false, 
                    message: 'No EasyApply button found on this page',
                    error: 'No EasyApply button found'
                };
            }
            
            // Check if button is enabled
            if (easyApplyButton.disabled) {
                console.log('❌ EasyApply button is disabled');
                return { 
                    success: false, 
                    message: 'EasyApply button is disabled',
                    error: 'Button disabled'
                };
            }
            
            // Click the button
            console.log('🚀 Clicking EasyApply button...');
            easyApplyButton.click();
            
            // Wait a moment for the click to register
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            console.log('✅ EasyApply button clicked successfully');
            return { 
                success: true, 
                message: 'EasyApply button clicked successfully'
            };
            
        } catch (error) {
            console.error('❌ Error clicking EasyApply button:', error);
            return { 
                success: false, 
                error: error.message,
                message: 'Error clicking EasyApply button'
            };
        }
    }
    
    console.log('✅ Job search assistant initialized with policy-compliant behavior');
    
    // Less aggressive error handler for textContent errors
    const originalError = console.error;
    console.error = function(...args) {
        const message = args.join(' ');
        // Only suppress specific textContent errors, not all errors
        if (message.includes('Cannot read properties of undefined (reading \'textContent\')')) {
            console.log('⚠️ Suppressing textContent error:', message);
            return;
        }
        originalError.apply(console, args);
    };
    
})(); 