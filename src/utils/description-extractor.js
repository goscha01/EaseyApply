// LinkedIn Job Description Extractor & AI CV Tailor
// Extract job details and send to AI for personalized CV generation

(function() {
    'use strict';
    
    console.log("🎯 LinkedIn Job Description Extractor & AI CV Tailor");
    console.log("=====================================================");
    
    // Configuration
    const config = {
        aiEndpoints: {
            openai: 'https://api.openai.com/v1/chat/completions',
            claude: 'https://api.anthropic.com/v1/messages',
            local: 'http://localhost:11434/api/generate', // Ollama
            custom: '' // Your custom AI service
        },
        extraction: {
            includeCompanyInfo: true,
            includeSalary: true,
            includeLocation: true,
            includeKeywords: true,
            includeRequirements: true
        }
    };
    
    // Your base CV data (you'd populate this)
    const baseCVData = {
        personalInfo: {
            name: "Your Name",
            email: "your.email@example.com",
            phone: "(555) 123-4567",
            linkedin: "linkedin.com/in/yourprofile",
            github: "github.com/yourusername",
            website: "yourwebsite.com"
        },
        summary: "Experienced software engineer with expertise in...",
        experience: [
            {
                title: "Senior Software Engineer",
                company: "Tech Corp",
                duration: "2021 - Present",
                achievements: [
                    "Built scalable microservices handling 1M+ requests/day",
                    "Led team of 5 developers on critical product features",
                    "Reduced system latency by 40% through optimization"
                ]
            }
            // Add more experiences
        ],
        skills: {
            technical: ["JavaScript", "Python", "React", "Node.js", "AWS", "Docker"],
            soft: ["Leadership", "Problem Solving", "Communication", "Agile"]
        },
        education: [
            {
                degree: "BS Computer Science",
                school: "University Name",
                year: "2018"
            }
        ],
        projects: [
            {
                name: "Project Name",
                description: "Built a web application that...",
                technologies: ["React", "Node.js", "MongoDB"]
            }
        ]
    };
    
    // Job extraction functions
    function extractJobDescription() {
        console.log("🔍 Extracting job description from current page...");
        
        const jobData = {
            title: null,
            company: null,
            location: null,
            salary: null,
            description: null,
            requirements: [],
            keywords: [],
            benefits: [],
            jobType: null,
            experience: null,
            url: window.location.href,
            extractedAt: new Date().toISOString()
        };
        
        try {
            // Extract job title
            const titleSelectors = [
                'h1[data-test="job-title"]',
                '.job-details-jobs-unified-top-card__job-title h1',
                '.jobs-unified-top-card__job-title h1',
                'h1.t-24',
                'h1'
            ];
            
            for (const selector of titleSelectors) {
                const element = document.querySelector(selector);
                if (element && element.textContent.trim()) {
                    jobData.title = element.textContent.trim();
                    break;
                }
            }
            
            // Extract company name
            const companySelectors = [
                '[data-test="job-company-name"]',
                '.job-details-jobs-unified-top-card__company-name a',
                '.jobs-unified-top-card__company-name a',
                '.job-details-jobs-unified-top-card__company-name',
                '.jobs-unified-top-card__company-name'
            ];
            
            for (const selector of companySelectors) {
                const element = document.querySelector(selector);
                if (element && element.textContent.trim()) {
                    jobData.company = element.textContent.trim();
                    break;
                }
            }
            
            // Extract location
            const locationSelectors = [
                '[data-test="job-location"]',
                '.job-details-jobs-unified-top-card__primary-description-container .t-black--light',
                '.jobs-unified-top-card__bullet'
            ];
            
            for (const selector of locationSelectors) {
                const elements = document.querySelectorAll(selector);
                for (const element of elements) {
                    const text = element.textContent.trim();
                    if (text && (text.includes(',') || text.includes('Remote') || text.includes('Hybrid'))) {
                        jobData.location = text;
                        break;
                    }
                }
                if (jobData.location) break;
            }
            
            // Extract salary if available
            const salarySelectors = [
                '[data-test="job-salary"]',
                '.job-details-jobs-unified-top-card__job-insight span',
                '.jobs-unified-top-card__job-insight span'
            ];
            
            for (const selector of salarySelectors) {
                const elements = document.querySelectorAll(selector);
                for (const element of elements) {
                    const text = element.textContent.trim();
                    if (text && (text.includes('$') || text.includes('salary') || text.includes('/year'))) {
                        jobData.salary = text;
                        break;
                    }
                }
                if (jobData.salary) break;
            }
            
            // Extract job description
            const descriptionSelectors = [
                '[data-test="job-description"]',
                '.job-details-jobs-unified-top-card__job-description',
                '.jobs-description-content__text',
                '.jobs-box__html-content',
                '.job-view-layout .jobs-description'
            ];
            
            for (const selector of descriptionSelectors) {
                const element = document.querySelector(selector);
                if (element && element.textContent.trim()) {
                    jobData.description = element.textContent.trim();
                    break;
                }
            }
            
            // Extract job type and experience
            const insightSelectors = [
                '.job-details-jobs-unified-top-card__job-insight',
                '.jobs-unified-top-card__job-insight'
            ];
            
            for (const selector of insightSelectors) {
                const elements = document.querySelectorAll(selector);
                elements.forEach(element => {
                    const text = element.textContent.trim().toLowerCase();
                    if (text.includes('full-time') || text.includes('part-time') || text.includes('contract')) {
                        jobData.jobType = text;
                    }
                    if (text.includes('year') && text.includes('experience')) {
                        jobData.experience = text;
                    }
                });
            }
            
        } catch (error) {
            console.error("Error extracting job data:", error);
        }
        
        // Process and enhance the extracted data
        if (jobData.description) {
            jobData.requirements = extractRequirements(jobData.description);
            jobData.keywords = extractKeywords(jobData.description);
            jobData.benefits = extractBenefits(jobData.description);
        }
        
        return jobData;
    }
    
    function extractRequirements(description) {
        const requirements = [];
        const lines = description.split('\n');
        
        let inRequirementsSection = false;
        
        for (const line of lines) {
            const trimmed = line.trim().toLowerCase();
            
            // Look for requirements sections
            if (trimmed.includes('requirement') || 
                trimmed.includes('qualification') || 
                trimmed.includes('must have') ||
                trimmed.includes('you will need')) {
                inRequirementsSection = true;
                continue;
            }
            
            // Stop at other sections
            if (trimmed.includes('benefit') || 
                trimmed.includes('we offer') ||
                trimmed.includes('about us')) {
                inRequirementsSection = false;
                continue;
            }
            
            // Extract bullet points or numbered items
            if (inRequirementsSection && (line.includes('•') || line.includes('-') || /^\d+\./.test(line.trim()))) {
                const requirement = line.replace(/^[\s\-\•\d\.]+/, '').trim();
                if (requirement.length > 10) {
                    requirements.push(requirement);
                }
            }
        }
        
        return requirements;
    }
    
    function extractKeywords(description) {
        const keywords = new Set();
        
        // Common tech keywords to look for
        const techKeywords = [
            'JavaScript', 'Python', 'Java', 'React', 'Angular', 'Vue', 'Node.js',
            'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'Git', 'SQL', 'NoSQL',
            'MongoDB', 'PostgreSQL', 'Redis', 'GraphQL', 'REST', 'API',
            'Machine Learning', 'AI', 'Data Science', 'DevOps', 'CI/CD',
            'Agile', 'Scrum', 'Leadership', 'Team Lead', 'Senior', 'Full Stack'
        ];
        
        const lowerDescription = description.toLowerCase();
        
        techKeywords.forEach(keyword => {
            if (lowerDescription.includes(keyword.toLowerCase())) {
                keywords.add(keyword);
            }
        });
        
        return Array.from(keywords);
    }
    
    function extractBenefits(description) {
        const benefits = [];
        const lines = description.split('\n');
        
        let inBenefitsSection = false;
        
        for (const line of lines) {
            const trimmed = line.trim().toLowerCase();
            
            if (trimmed.includes('benefit') || 
                trimmed.includes('we offer') ||
                trimmed.includes('perks') ||
                trimmed.includes('package includes')) {
                inBenefitsSection = true;
                continue;
            }
            
            if (trimmed.includes('requirement') || 
                trimmed.includes('qualification') ||
                trimmed.includes('about the role')) {
                inBenefitsSection = false;
                continue;
            }
            
            if (inBenefitsSection && (line.includes('•') || line.includes('-') || /^\d+\./.test(line.trim()))) {
                const benefit = line.replace(/^[\s\-\•\d\.]+/, '').trim();
                if (benefit.length > 5) {
                    benefits.push(benefit);
                }
            }
        }
        
        return benefits;
    }
    
    // AI Integration functions
    function generateAIPrompt(jobData, cvData) {
        return `
Please help me tailor my CV for this specific job opportunity. Here's the job information:

**Job Title:** ${jobData.title}
**Company:** ${jobData.company}
**Location:** ${jobData.location || 'Not specified'}

**Job Requirements:**
${jobData.requirements.map(req => `- ${req}`).join('\n')}

**Key Technologies/Keywords:** ${jobData.keywords.join(', ')}

**Job Description:** ${jobData.description}

**My Current CV Data:**
${JSON.stringify(cvData, null, 2)}

Please provide:
1. A tailored professional summary that highlights relevant experience for this role
2. Suggested modifications to my experience descriptions to better match the job requirements
3. Skills to emphasize based on the job requirements
4. Specific achievements or projects to highlight
5. Keywords to incorporate naturally throughout the CV
6. A tailored cover letter opening paragraph

Please ensure all suggestions are truthful and based on my actual experience while optimizing for this specific role.
`;
    }
    
    async function sendToAI(prompt, endpoint = 'openai') {
        console.log("🤖 Sending job data to AI for CV tailoring...");
        
        try {
            let response;
            
            switch (endpoint) {
                case 'openai':
                    response = await sendToOpenAI(prompt);
                    break;
                case 'claude':
                    response = await sendToClaude(prompt);
                    break;
                case 'local':
                    response = await sendToLocalAI(prompt);
                    break;
                default:
                    throw new Error('Unsupported AI endpoint');
            }
            
            return response;
            
        } catch (error) {
            console.error("Error communicating with AI:", error);
            throw error;
        }
    }
    
    async function sendToOpenAI(prompt) {
        const apiKey = localStorage.getItem('openai_api_key') || prompt('Enter your OpenAI API key:');
        if (apiKey) localStorage.setItem('openai_api_key', apiKey);
        
        const response = await fetch(config.aiEndpoints.openai, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-4',
                messages: [
                    {
                        role: 'system',
                        content: 'You are a professional CV writing expert specializing in tech roles. Provide specific, actionable advice for tailoring CVs to job descriptions.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                max_tokens: 2000,
                temperature: 0.7
            }),
            signal: abortController ? abortController.signal : undefined
        });
        
        const data = await response.json();
        return data.choices[0].message.content;
    }
    
    async function sendToClaude(prompt) {
        const apiKey = localStorage.getItem('claude_api_key') || prompt('Enter your Anthropic API key:');
        if (apiKey) localStorage.setItem('claude_api_key', apiKey);
        
        const response = await fetch(config.aiEndpoints.claude, {
            method: 'POST',
            headers: {
                'x-api-key': apiKey,
                'Content-Type': 'application/json',
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-3-sonnet-20240229',
                max_tokens: 2000,
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ]
            }),
            signal: abortController ? abortController.signal : undefined
        });
        
        const data = await response.json();
        return data.content[0].text;
    }
    
    async function sendToLocalAI(prompt) {
        // For local Ollama or similar
        const response = await fetch(config.aiEndpoints.local, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'llama2', // or your preferred local model
                prompt: prompt,
                stream: false
            }),
            signal: abortController ? abortController.signal : undefined
        });
        
        const data = await response.json();
        return data.response;
    }
    
    // Stop operation function
    function stopCurrentOperation() {
        if (abortController) {
            abortController.abort();
            abortController = null;
        }
        
        currentOperation = null;
        
        // Reset UI
        const stopBtn = document.getElementById('stop-btn');
        const extractBtn = document.getElementById('extract-job-btn');
        const processBtn = document.getElementById('process-job-btn');
        const status = document.getElementById('status');
        
        if (stopBtn) stopBtn.style.display = 'none';
        if (extractBtn) {
            extractBtn.disabled = false;
            extractBtn.textContent = '🔍 Extract Job Data';
        }
        if (processBtn) {
            processBtn.disabled = false;
            processBtn.textContent = '🤖 Generate AI Tailoring';
        }
        if (status) {
            status.innerHTML = '⏹️ Operation stopped by user';
            status.style.color = '#dc3545';
        }
        
        console.log("⏹️ Operation stopped by user");
    }
    
    // Main workflow functions
    async function processCurrentJob(aiEndpoint = 'openai') {
        try {
            console.log("🚀 Starting job processing workflow...");
            
            // Set up abort controller for this operation
            abortController = new AbortController();
            currentOperation = 'processing';
            
            // Show stop button
            const stopBtn = document.getElementById('stop-btn');
            if (stopBtn) stopBtn.style.display = 'block';
            
            // Step 1: Extract job data
            const jobData = extractJobDescription();
            
            if (!jobData.title || !jobData.description) {
                throw new Error("Could not extract sufficient job information from this page");
            }
            
            console.log("✅ Job data extracted:");
            console.log(`   Title: ${jobData.title}`);
            console.log(`   Company: ${jobData.company}`);
            console.log(`   Keywords: ${jobData.keywords.join(', ')}`);
            console.log(`   Requirements: ${jobData.requirements.length} found`);
            
            // Check if operation was stopped
            if (abortController.signal.aborted) {
                throw new Error("Operation cancelled by user");
            }
            
            // Step 2: Generate AI prompt
            const prompt = generateAIPrompt(jobData, baseCVData);
            
            // Step 3: Send to AI
            const aiResponse = await sendToAI(prompt, aiEndpoint);
            
            // Check if operation was stopped
            if (abortController.signal.aborted) {
                throw new Error("Operation cancelled by user");
            }
            
            // Step 4: Display results
            displayResults(jobData, aiResponse);
            
            // Step 5: Save data for later use
            saveJobData(jobData, aiResponse);
            
            // Reset operation state
            currentOperation = null;
            abortController = null;
            
            // Hide stop button
            if (stopBtn) stopBtn.style.display = 'none';
            
            return { jobData, aiResponse };
            
        } catch (error) {
            console.error("❌ Error in job processing workflow:", error);
            
            // Reset operation state
            currentOperation = null;
            abortController = null;
            
            // Hide stop button
            const stopBtn = document.getElementById('stop-btn');
            if (stopBtn) stopBtn.style.display = 'none';
            
            throw error;
        }
    }
    
    function displayResults(jobData, aiResponse) {
        // Remove existing results
        const existing = document.getElementById('cv-tailor-results');
        if (existing) existing.remove();
        
        // Create results panel
        const resultsPanel = document.createElement('div');
        resultsPanel.id = 'cv-tailor-results';
        resultsPanel.style.cssText = `
            position: fixed;
            top: 50px;
            right: 20px;
            width: 400px;
            max-height: 80vh;
            background: white;
            border: 2px solid #28a745;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10000;
            font-family: Arial, sans-serif;
            font-size: 14px;
            overflow-y: auto;
        `;
        
        resultsPanel.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <strong style="color: #28a745;">🎯 AI CV Tailoring Results</strong>
                <button onclick="this.parentElement.parentElement.remove()" style="background: none; border: none; font-size: 18px; cursor: pointer;">×</button>
            </div>
            
            <div style="background: #d4edda; padding: 10px; border-radius: 4px; margin-bottom: 15px;">
                <strong>Job:</strong> ${jobData.title}<br>
                <strong>Company:</strong> ${jobData.company}<br>
                <strong>Keywords:</strong> ${jobData.keywords.slice(0, 5).join(', ')}${jobData.keywords.length > 5 ? '...' : ''}
            </div>
            
            <div style="margin-bottom: 15px;">
                <strong>🤖 AI Recommendations:</strong>
                <div style="background: #f8f9fa; padding: 10px; border-radius: 4px; margin-top: 5px; max-height: 300px; overflow-y: auto; white-space: pre-wrap; font-size: 12px;">
${aiResponse}
                </div>
            </div>
            
            <div style="display: flex; gap: 8px; margin-top: 15px;">
                <button id="copy-recommendations" style="flex: 1; padding: 8px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">
                    📋 Copy All
                </button>
                <button id="save-data" style="flex: 1; padding: 8px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer;">
                    💾 Save Data
                </button>
            </div>
            
            <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #ddd; font-size: 11px; color: #666;">
                Use these recommendations to manually update your CV and cover letter
            </div>
        `;
        
        document.body.appendChild(resultsPanel);
        
        // Add event listeners
        document.getElementById('copy-recommendations').addEventListener('click', () => {
            navigator.clipboard.writeText(aiResponse).then(() => {
                alert('AI recommendations copied to clipboard!');
            });
        });
        
        document.getElementById('save-data').addEventListener('click', () => {
            const dataToSave = {
                job: jobData,
                recommendations: aiResponse,
                timestamp: new Date().toISOString()
            };
            
            const blob = new Blob([JSON.stringify(dataToSave, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `cv-tailoring-${jobData.company}-${Date.now()}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });
    }
    
    function saveJobData(jobData, aiResponse) {
        const savedJobs = JSON.parse(localStorage.getItem('saved_job_tailoring') || '[]');
        
        savedJobs.push({
            job: jobData,
            recommendations: aiResponse,
            timestamp: new Date().toISOString()
        });
        
        // Keep only last 10 jobs
        if (savedJobs.length > 10) {
            savedJobs.splice(0, savedJobs.length - 10);
        }
        
        localStorage.setItem('saved_job_tailoring', JSON.stringify(savedJobs));
    }
    
    // Global variables for tracking operations
    let currentOperation = null;
    let abortController = null;
    
    // Create control panel
    function createControlPanel() {
        const panel = document.createElement('div');
        panel.id = 'cv-tailor-panel';
        panel.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            width: 320px;
            background: white;
            border: 2px solid #28a745;
            border-radius: 8px;
            padding: 15px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            z-index: 10000;
            font-family: Arial, sans-serif;
            font-size: 14px;
        `;
        
        panel.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <strong style="color: #28a745;">🎯 AI CV Tailor</strong>
                <button onclick="this.parentElement.parentElement.remove()" style="background: none; border: none; font-size: 18px; cursor: pointer;">×</button>
            </div>
            
            <div style="background: #d1ecf1; padding: 8px; border-radius: 4px; margin-bottom: 10px; font-size: 12px;">
                <strong>Smart & Legal:</strong> Extract job descriptions and get AI-powered CV tailoring recommendations
            </div>
            
            <div style="margin-bottom: 10px;">
                <label style="display: block; margin-bottom: 5px; font-size: 12px;">AI Service:</label>
                <select id="ai-endpoint" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 4px;">
                    <option value="openai">OpenAI GPT-4</option>
                    <option value="claude">Anthropic Claude</option>
                    <option value="local">Local AI (Ollama)</option>
                </select>
            </div>
            
            <button id="extract-job-btn" style="width: 100%; margin-bottom: 8px; padding: 10px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">
                🔍 Extract Job Data
            </button>
            
            <button id="process-job-btn" style="width: 100%; margin-bottom: 8px; padding: 10px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer;">
                🤖 Generate AI Tailoring
            </button>
            
            <button id="stop-btn" style="width: 100%; margin-bottom: 8px; padding: 10px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; display: none;">
                ⏹️ Stop Operation
            </button>
            
            <button id="view-history-btn" style="width: 100%; margin-bottom: 8px; padding: 8px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
                📚 View History
            </button>
            
            <button id="test-stop-btn" style="width: 100%; margin-bottom: 8px; padding: 8px; background: #ffc107; color: black; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
                🧪 Test Stop Button
            </button>
            
            <div id="status" style="margin-top: 10px; font-size: 12px; color: #666;">
                Navigate to a LinkedIn job posting and click "Extract Job Data"
            </div>
        `;
        
        document.body.appendChild(panel);
        
        // Add event listeners
        document.getElementById('extract-job-btn').addEventListener('click', () => {
            try {
                // Set up abort controller for extraction
                abortController = new AbortController();
                currentOperation = 'extracting';
                
                // Show stop button and disable other buttons
                const stopBtn = document.getElementById('stop-btn');
                const extractBtn = document.getElementById('extract-job-btn');
                const processBtn = document.getElementById('process-job-btn');
                const status = document.getElementById('status');
                
                if (stopBtn) stopBtn.style.display = 'block';
                if (extractBtn) {
                    extractBtn.disabled = true;
                    extractBtn.textContent = '⏳ Extracting...';
                }
                if (processBtn) processBtn.disabled = true;
                
                status.innerHTML = 'Extracting job data...';
                status.style.color = '#007bff';
                
                const jobData = extractJobDescription();
                
                // Check if operation was stopped
                if (abortController.signal.aborted) {
                    throw new Error("Operation cancelled by user");
                }
                
                if (jobData.title && jobData.description) {
                    status.innerHTML = `✅ Extracted: ${jobData.title} at ${jobData.company}<br>Keywords: ${jobData.keywords.slice(0, 3).join(', ')}`;
                    status.style.color = '#28a745';
                } else {
                    status.innerHTML = '❌ Could not extract job data. Make sure you\'re on a LinkedIn job posting page.';
                    status.style.color = '#dc3545';
                }
                
                // Reset UI
                currentOperation = null;
                abortController = null;
                if (stopBtn) stopBtn.style.display = 'none';
                if (extractBtn) {
                    extractBtn.disabled = false;
                    extractBtn.textContent = '🔍 Extract Job Data';
                }
                if (processBtn) processBtn.disabled = false;
                
            } catch (error) {
                document.getElementById('status').innerHTML = `❌ Error: ${error.message}`;
                
                // Reset UI on error
                currentOperation = null;
                abortController = null;
                const stopBtn = document.getElementById('stop-btn');
                const extractBtn = document.getElementById('extract-job-btn');
                const processBtn = document.getElementById('process-job-btn');
                
                if (stopBtn) stopBtn.style.display = 'none';
                if (extractBtn) {
                    extractBtn.disabled = false;
                    extractBtn.textContent = '🔍 Extract Job Data';
                }
                if (processBtn) processBtn.disabled = false;
            }
        });
        
        document.getElementById('process-job-btn').addEventListener('click', async () => {
            const btn = document.getElementById('process-job-btn');
            const extractBtn = document.getElementById('extract-job-btn');
            const stopBtn = document.getElementById('stop-btn');
            const status = document.getElementById('status');
            const aiEndpoint = document.getElementById('ai-endpoint').value;
            
            // Show stop button and disable other buttons
            if (stopBtn) stopBtn.style.display = 'block';
            if (extractBtn) extractBtn.disabled = true;
            btn.disabled = true;
            btn.textContent = '⏳ Processing...';
            status.innerHTML = 'Extracting job data and sending to AI...';
            status.style.color = '#007bff';
            
            try {
                await processCurrentJob(aiEndpoint);
                status.innerHTML = '✅ AI tailoring complete! Check the results panel.';
                status.style.color = '#28a745';
            } catch (error) {
                status.innerHTML = `❌ Error: ${error.message}`;
                status.style.color = '#dc3545';
            } finally {
                btn.disabled = false;
                btn.textContent = '🤖 Generate AI Tailoring';
                if (extractBtn) extractBtn.disabled = false;
                if (stopBtn) stopBtn.style.display = 'none';
            }
        });
        
        // Add stop button event listener
        document.getElementById('stop-btn').addEventListener('click', () => {
            stopCurrentOperation();
        });
        
        // Add test stop button event listener
        document.getElementById('test-stop-btn').addEventListener('click', () => {
            const stopBtn = document.getElementById('stop-btn');
            const status = document.getElementById('status');
            
            if (stopBtn) {
                stopBtn.style.display = 'block';
                status.innerHTML = '🧪 Stop button is now visible! Click it to test.';
                status.style.color = '#ffc107';
            }
        });
        
        document.getElementById('view-history-btn').addEventListener('click', () => {
            const savedJobs = JSON.parse(localStorage.getItem('saved_job_tailoring') || '[]');
            
            if (savedJobs.length === 0) {
                alert('No saved job tailoring history found.');
                return;
            }
            
            const historyWindow = window.open('', '_blank', 'width=800,height=600');
            historyWindow.document.write(`
                <html>
                <head><title>CV Tailoring History</title></head>
                <body style="font-family: Arial, sans-serif; padding: 20px;">
                    <h2>🎯 CV Tailoring History</h2>
                    ${savedJobs.map((item, index) => `
                        <div style="border: 1px solid #ddd; border-radius: 8px; padding: 15px; margin-bottom: 15px;">
                            <h3>${item.job.title} at ${item.job.company}</h3>
                            <p><strong>Date:</strong> ${new Date(item.timestamp).toLocaleDateString()}</p>
                            <p><strong>Keywords:</strong> ${item.job.keywords.join(', ')}</p>
                            <details>
                                <summary style="cursor: pointer; font-weight: bold;">View AI Recommendations</summary>
                                <pre style="white-space: pre-wrap; background: #f8f9fa; padding: 10px; border-radius: 4px; font-size: 12px;">${item.recommendations}</pre>
                            </details>
                        </div>
                    `).join('')}
                </body>
                </html>
            `);
        });
    }
    
    // Initialize
    console.log("🚀 CV Tailor loaded successfully!");
    console.log("📋 Navigate to LinkedIn job postings to extract and tailor your CV");
    
    createControlPanel();
    
    // Expose functions for manual use
    window.extractJobDescription = extractJobDescription;
    window.processCurrentJob = processCurrentJob;
    
})();