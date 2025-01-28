document.addEventListener('DOMContentLoaded', function() {
    // Check for API key first
    chrome.storage.local.get(['apiKey'], function(result) {
        if (!result.apiKey) {
            // Show API key setup, hide user form
            document.getElementById('apiKeySetup').classList.remove('hidden');
            document.getElementById('userForm').classList.add('hidden');
        } else {
            // Hide API key setup, show user form
            document.getElementById('apiKeySetup').classList.add('hidden');
            document.getElementById('userForm').classList.remove('hidden');
        }
    });

    // Handle API key form submission
    document.getElementById('apiKeyForm').addEventListener('submit', function(e) {
        e.preventDefault();
        const apiKey = document.getElementById('setupApiKey').value;
        
        chrome.storage.local.set({ apiKey: apiKey }, function() {
            showStatus('API key saved successfully!', 'success');
            // Hide API setup and show user form
            document.getElementById('apiKeySetup').classList.add('hidden');
            document.getElementById('userForm').classList.remove('hidden');
        });
    });

    // Check for user data and set initial active tab
    chrome.storage.local.get(['userData'], function(result) {
        const hasUserData = result.userData && 
            Object.values(result.userData).some(value => {
                // Check for non-empty strings and exclude parsedResumeContent from the check
                if (typeof value === 'string' && value.trim() !== '' && value !== result.userData.parsedResumeContent) {
                    return true;
                }
                // Check for resume data separately
                if (value === result.userData.resume && value !== null) {
                    return true;
                }
                return false;
            });
        
        // If user data exists, populate the form
        if (result.userData) {
            const fields = ['firstName', 'middleName', 'lastName', 'email', 'linkedinUrl', 'phone'];
            fields.forEach(field => {
                const element = document.getElementById(field);
                if (element && result.userData[field]) {
                    element.value = result.userData[field];
                }
            });
            
            // Set phone country if it exists
            const phoneCountryElement = document.getElementById('phoneCountry');
            if (phoneCountryElement && result.userData.phoneCountry) {
                phoneCountryElement.value = result.userData.phoneCountry;
            }
            
            // Update file upload visual state if there's a saved resume
            if (result.userData.resume) {
                const fileLabel = document.querySelector('.file-upload');
                const fileLabelText = fileLabel.querySelector('.upload-text');
                
                let fileName = 'Resume file saved';
                if (result.userData.resumeFileName) {
                    fileName = `Current file: ${result.userData.resumeFileName}`;
                }
                
                fileLabelText.innerHTML = fileName;
                fileLabel.style.borderColor = '#047857';
                fileLabel.style.backgroundColor = '#f0fdf4';
            }
        }
        
        // Set initial active tab based on user data
        const initialTab = hasUserData ? 'apply' : 'profile';
        activateTab(initialTab);
        
        // Update apply button state and status message
        const applyButton = document.getElementById('triggerApply');
        if (applyButton) {
            applyButton.disabled = !hasUserData;
            
            // Handle status message in apply tab
            const applyTab = document.getElementById('applyTab');
            const existingStatus = applyTab.querySelector('.status');
            
            if (!hasUserData) {
                // Only add the status message if it doesn't exist and there's no user data
                if (!existingStatus) {
                    const status = document.createElement('div');
                    status.className = 'status';
                    status.innerHTML = `
                        <svg class="info-icon" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"/>
                        </svg>
                        <div class="info-content">
                            <h3>Profile Setup Required</h3>
                            <p>Please fill at least one field in your profile to use the auto-fill feature.</p>
                        </div>
                    `;
                    applyTab.insertBefore(status, applyTab.firstChild);
                }
            } else {
                // Remove the status message if it exists and we have user data
                if (existingStatus) {
                    existingStatus.remove();
                }
            }
        }
    });

    // File input handling
    const fileInput = document.getElementById('resume');
    const fileLabel = fileInput.parentElement;
    const fileLabelText = fileLabel.querySelector('p');

    fileInput.addEventListener('change', function(e) {
        if (e.target.files.length > 0) {
            const fileName = e.target.files[0].name;
            fileLabelText.innerHTML = `Selected file: ${fileName}`;
            fileLabel.style.borderColor = '#047857';
            fileLabel.style.backgroundColor = '#f0fdf4';
        } else {
            fileLabelText.innerHTML = 'Click to upload or drag and drop';
            fileLabel.style.borderColor = '#ddd';
            fileLabel.style.backgroundColor = '#fff';
        }
    });

    // Tab switching functionality
    const tabs = document.querySelectorAll('.nav-button');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabId = tab.getAttribute('data-tab');
            activateTab(tabId);
        });
    });

    // Handle profile form submission
    document.getElementById('userForm').addEventListener('submit', function(e) {
        e.preventDefault();
        
        const resumeFile = document.getElementById('resume').files[0];
        if (resumeFile) {
            const reader = new FileReader();
            reader.onload = async function(e) {
                try {
                    if (resumeFile.type === 'application/pdf') {
                        console.log('Parsing PDF content...');
                        await parsePDFContent(e.target.result);
                    } else {
                        // For non-PDF files, just save the file data
                        saveUserData(e.target.result, null);
                    }
                } catch (error) {
                    console.error('Error handling file:', error);
                    showStatus('Error processing file. Please try again.', 'error');
                }
            };
            reader.onerror = function(error) {
                console.error('Error reading file:', error);
                showStatus('Error reading file. Please try again.', 'error');
            };
            reader.readAsDataURL(resumeFile);
        } else {
            // Handle form submission without file
            saveUserData(null, null);
        }
    });

    // Handle apply button click
    document.getElementById('triggerApply').addEventListener('click', function() {
        const button = this;
        const label = document.querySelector('.auto-fill-label');
        button.disabled = true;
        button.innerHTML = `
            <svg class="loading-icon" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
            </svg>
        `;
        label.textContent = 'Processing...';
        
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (!tabs[0]) {
                showStatus('No active tab found. Please try again.', 'error');
                resetButton(button, label);
                return;
            }

            // Function to inject content script
            const injectContentScript = () => {
                return new Promise((resolve) => {
                    chrome.scripting.executeScript({
                        target: { tabId: tabs[0].id },
                        files: ['content.js']
                    }, () => {
                        const error = chrome.runtime.lastError;
                        if (error) {
                            console.log('Script injection error:', error);
                        }
                        resolve();
                    });
                });
            };

            // Function to check if content script is ready with retries
            const checkContentScript = async (maxRetries = 3, retryDelay = 500) => {
                for (let i = 0; i < maxRetries; i++) {
                    try {
                        const response = await new Promise((resolve, reject) => {
                            chrome.tabs.sendMessage(tabs[0].id, { action: 'ping' }, response => {
                                if (chrome.runtime.lastError) {
                                    reject(chrome.runtime.lastError);
                                } else {
                                    resolve(response);
                                }
                            });
                        });
                        
                        if (response) {
                            return true;
                        }
                    } catch (error) {
                        console.log(`Retry ${i + 1}/${maxRetries} failed:`, error);
                        if (i < maxRetries - 1) {
                            await injectContentScript();
                            await new Promise(resolve => setTimeout(resolve, retryDelay));
                        }
                    }
                }
                return false;
            };

            // Main flow
            (async () => {
                try {
                    // First try to inject the content script
                    await injectContentScript();
                    
                    // Then check if it's ready with retries
                    const isReady = await checkContentScript();
                    
                    if (!isReady) {
                        showStatus('Error: Could not initialize page script. Please refresh the page and try again.', 'error');
                        resetButton(button, label);
                        return;
                    }

                    // Content script is ready, proceed with auto-fill
                    chrome.storage.local.get(['userData', 'apiKey'], function(result) {
                        if (!result.userData) {
                            showStatus('Please set up your profile first!', 'error');
                            resetButton(button, label);
                            return;
                        }
                        
                        if (!result.apiKey) {
                            showStatus('Please set up your Gemini API key first!', 'error');
                            resetButton(button, label);
                            return;
                        }

                        chrome.tabs.sendMessage(tabs[0].id, { 
                            action: 'triggerAutofill',
                            apiKey: result.apiKey,
                            userData: result.userData
                        }, function(response) {
                            if (chrome.runtime.lastError) {
                                showStatus('Error: Could not connect to page. Please refresh and try again.', 'error');
                            } else if (response && response.success) {
                                showStatus('Application form auto-filled successfully! 🎉', 'success');
                            } else {
                                showStatus('Error auto-filling the form. Please try again.', 'error');
                            }
                            resetButton(button, label);
                        });
                    });
                } catch (error) {
                    console.error('Error during auto-fill process:', error);
                    showStatus('An unexpected error occurred. Please try again.', 'error');
                    resetButton(button, label);
                }
            })();
        });
    });
});

// Helper function to activate tab
function activateTab(tabId) {
    // Update tab buttons
    document.querySelectorAll('.nav-button').forEach(t => {
        if (t.getAttribute('data-tab') === tabId) {
            t.classList.add('active');
        } else {
            t.classList.remove('active');
        }
    });
    
    // Update tab contents
    document.querySelectorAll('.tab-content').forEach(c => {
        if (c.id === tabId + 'Tab') {
            c.classList.remove('hidden');
            
            // Load saved data when profile tab is opened
            if (tabId === 'profile') {
                chrome.storage.local.get(['userData'], function(result) {
                    if (result.userData) {
                        const fields = ['firstName', 'middleName', 'lastName', 'email', 'linkedinUrl', 'phone'];
                        fields.forEach(field => {
                            const element = document.getElementById(field);
                            if (element && result.userData[field]) {
                                element.value = result.userData[field];
                            }
                        });
                        
                        // Set phone country if it exists
                        const phoneCountryElement = document.getElementById('phoneCountry');
                        if (phoneCountryElement && result.userData.phoneCountry) {
                            phoneCountryElement.value = result.userData.phoneCountry;
                        }
                        
                        // Update the file upload visual state if there's a saved resume
                        if (result.userData.resume) {
                            const fileLabel = document.querySelector('.file-upload');
                            const fileLabelText = fileLabel.querySelector('.upload-text');
                            
                            let fileName = 'Resume file saved';
                            if (result.userData.resumeFileName) {
                                fileName = `Current file: ${result.userData.resumeFileName}`;
                            }
                            
                            fileLabelText.innerHTML = fileName;
                            fileLabel.style.borderColor = '#047857';
                            fileLabel.style.backgroundColor = '#f0fdf4';
                        }
                    }
                });
            }
        } else {
            c.classList.add('hidden');
        }
    });
}

// Helper function to show status messages
function showStatus(message, type) {
    const statusDiv = document.createElement('div');
    statusDiv.className = `status ${type}`;
    
    const icon = type === 'success' 
        ? `<svg class="info-icon" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"/>
        </svg>`
        : `<svg class="info-icon" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"/>
        </svg>`;
    
    statusDiv.innerHTML = `
        ${icon}
        <div class="info-content">
            <p>${message}</p>
        </div>
    `;
    
    // Remove any existing status messages
    const existingStatus = document.querySelector('.status.success, .status.error');
    if (existingStatus) {
        existingStatus.remove();
    }
    
    // Add the new status message at the top of the content
    const content = document.querySelector('.content');
    content.insertBefore(statusDiv, content.firstChild);
    
    // Remove the status message after 3 seconds
    setTimeout(() => {
        statusDiv.remove();
    }, 3000);
}

// Helper function to reset button state
function resetButton(button, label) {
    button.disabled = false;
    button.innerHTML = `
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
        </svg>
    `;
    if (label) {
        label.textContent = 'Auto-Fill Application';
    }
}

// Function to load PDF.js scripts
async function loadPDFJS() {
    if (window.pdfjsLib) {
        return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
        // Load the main PDF.js script
        const script = document.createElement('script');
        script.src = chrome.runtime.getURL('lib/pdf.min.js');
        script.onload = () => {
            // Set worker source to local file
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('lib/pdf.worker.min.js');
            // Give the worker a moment to initialize
            setTimeout(resolve, 100);
        };
        script.onerror = () => reject(new Error('Failed to load PDF.js'));
        document.head.appendChild(script);
    });
}

// Function to parse PDF content
async function parsePDFContent(pdfData) {
    try {
        console.log('Parsing PDF content...');
        // Ensure PDF.js is loaded
        await loadPDFJS();

        // Show loading status
        showStatus('Parsing PDF content...', 'info');

        // Parse the PDF
        const loadingTask = window.pdfjsLib.getDocument({data: atob(pdfData.split(',')[1])});
        const pdf = await loadingTask.promise;
        let textContent = '';
        
        // Extract text from all pages
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            textContent += content.items.map(item => item.str).join(' ') + '\n';
        }
        
        // Clean up the extracted text
        textContent = textContent
            .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
            .replace(/\n\s*\n/g, '\n')  // Replace multiple newlines with single newline
            .trim();  // Remove leading/trailing whitespace
        console.log(textContent);
        console.log('Successfully parsed PDF content:');
        
        // Save both the PDF data and its text content
        saveUserData(pdfData, textContent);
    } catch (error) {
        console.error('Error parsing PDF:', error);
        showStatus('Error parsing PDF content. Please try a different file.', 'error');
    }
}

// Function to save user data
function saveUserData(fileData, pdfContent) {
    const userData = {
        firstName: document.getElementById('firstName').value,
        middleName: document.getElementById('middleName').value,
        lastName: document.getElementById('lastName').value,
        email: document.getElementById('email').value,
        linkedinUrl: document.getElementById('linkedinUrl').value,
        phoneCountry: document.getElementById('phoneCountry').value,
        phone: document.getElementById('phone').value,
        resume: fileData,
        parsedResumeContent: pdfContent,
        resumeFileName: fileData ? document.getElementById('resume').files[0].name : null
    };

    // Save to chrome.storage.local
    chrome.storage.local.set({ userData: userData }, function() {
        if (chrome.runtime.lastError) {
            showStatus('Error saving profile: ' + chrome.runtime.lastError.message, 'error');
            return;
        }
        
        showStatus('Profile saved successfully!', 'success');
        
        // Update the Apply button state
        const hasData = Object.values(userData).some(value => {
            // Check for non-empty strings and exclude parsedResumeContent
            if (typeof value === 'string' && value.trim() !== '' && value !== userData.parsedResumeContent) {
                return true;
            }
            // Check for resume data separately
            if (value === userData.resume && value !== null) {
                return true;
            }
            return false;
        });
        
        // Get the current active tab and reinject the content script
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (tabs[0]) {
                // First check if we can communicate with the existing content script
                chrome.tabs.sendMessage(tabs[0].id, { action: 'ping' }, function(response) {
                    const lastError = chrome.runtime.lastError; // This line is needed to prevent uncaught errors
                    
                    if (!response) {
                        // If no response, inject the content script
                        chrome.scripting.executeScript({
                            target: { tabId: tabs[0].id },
                            files: ['content.js']
                        }, function() {
                            const lastInjectionError = chrome.runtime.lastError;
                            if (!lastInjectionError) {
                                proceedWithTabSwitch();
                            } else {
                                console.log('Script injection error:', lastInjectionError);
                                proceedWithTabSwitch();
                            }
                        });
                    } else {
                        proceedWithTabSwitch();
                    }
                });
            } else {
                proceedWithTabSwitch();
            }
        });

        function proceedWithTabSwitch() {
            // Switch to apply tab after successful save
            setTimeout(() => {
                activateTab('apply');
                
                // Update apply button and UI state after tab switch
                const applyButton = document.getElementById('triggerApply');
                if (applyButton) {
                    applyButton.disabled = !hasData;
                    
                    const applyTab = document.getElementById('applyTab');
                    const existingStatus = applyTab.querySelector('.status');
                    
                    if (!hasData) {
                        // Only add the status message if it doesn't exist and there's no user data
                        if (!existingStatus) {
                            const status = document.createElement('div');
                            status.className = 'status';
                            status.innerHTML = `
                                <svg class="info-icon" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"/>
                                </svg>
                                <div class="info-content">
                                    <h3>Profile Setup Required</h3>
                                    <p>Please fill at least one field in your profile to use the auto-fill feature.</p>
                                </div>
                            `;
                            applyTab.insertBefore(status, applyTab.firstChild);
                        }
                    } else {
                        // Remove the status message if it exists and we have data
                        if (existingStatus) {
                            existingStatus.remove();
                        }
                    }
                }
            }, 100); // Reduced timeout to make it more responsive
        }
    });
}
  