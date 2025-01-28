// Add debounce helper at the top
let isProcessing = false;
let lastProcessTime = 0;
const DEBOUNCE_DELAY = 1000; // 1 second

// Function to extract form content
function extractFormContent() {
    const forms = document.querySelectorAll('form');
    let formContent = {
        fields: []
    };
    
    forms.forEach(form => {
        const inputs = form.querySelectorAll('input, textarea, select');
        inputs.forEach(input => {
            // Get the label text from various sources
            let label = '';
            // First try to get the associated label
            if (input.labels && input.labels.length > 0) {
                label = input.labels[0].textContent.trim();
            }
            // If no label, try aria-label
            if (!label) {
                label = input.getAttribute('aria-label') || '';
            }
            // If still no label, try placeholder
            if (!label) {
                label = input.getAttribute('placeholder') || '';
            }
            // If still no label, try name or id
            if (!label) {
                label = input.name || input.id || '';
            }
            
            // Create field object with the actual field identifier
            const field = {
                label: label,
                type: input.type,
                id: input.id,
                name: input.name,
                className: input.className,
                required: input.required,
                placeholder: input.getAttribute('placeholder') || '',
                ariaLabel: input.getAttribute('aria-label') || '',
                accept: input.getAttribute('accept') || '',
                parentElement: {
                    id: input.parentElement?.id || '',
                    className: input.parentElement?.className || '',
                    dataTestId: input.parentElement?.getAttribute('data-testid') || ''
                }
            };
            
            formContent.fields.push(field);
        });
    });
    
    return formContent;
}

// Function to parse full name into components
function parseFullName(fullName) {
    if (!fullName) return { firstName: '', middleName: '', lastName: '' };
    
    const nameParts = fullName.trim().split(/\s+/);
    
    if (nameParts.length === 1) {
        return {
            firstName: nameParts[0],
            middleName: '',
            lastName: ''
        };
    } else if (nameParts.length === 2) {
        return {
            firstName: nameParts[0],
            middleName: '',
            lastName: nameParts[1]
        };
    } else {
        return {
            firstName: nameParts[0],
            middleName: nameParts.slice(1, -1).join(' '),
            lastName: nameParts[nameParts.length - 1]
        };
    }
}

// Function to find element by selector list
function findElementBySelectors(mainSelector, fallbackSelectors = []) {
    // Helper function to escape special characters in ID selectors
    function escapeSelector(selector) {
        try {
            // Handle special selectors that start with colon
            if (selector.startsWith(':')) {
                return `[id="${selector.substring(1)}"]`;
            }

            // Split compound selectors and handle each part separately
            return selector.split(',').map(part => {
                part = part.trim();
                
                // Handle ID selectors with special characters
                if (part.includes('#')) {
                    const [beforeHash, afterHash] = part.split('#');
                    const idPart = afterHash.split(/[\[\s]/)[0]; // Get the ID part before any attributes
                    const rest = afterHash.includes('[') ? afterHash.substring(afterHash.indexOf('[')) : '';
                    return beforeHash + '#' + CSS.escape(idPart) + rest;
                }
                
                return part;
            }).join(', ');
        } catch (e) {
            console.log('Error escaping selector:', e);
            return selector;
        }
    }

    // Try each part of the selector separately for better reliability
    if (mainSelector.includes(',')) {
        const selectorParts = mainSelector.split(',').map(part => part.trim());
        for (const part of selectorParts) {
            try {
                const escapedPart = escapeSelector(part);
                const element = document.querySelector(escapedPart);
                if (element) return element;
            } catch (e) {
                console.log(`Error with selector part "${part}":`, e);
            }
        }
    } else {
        // Try main selector if it's not compound
        try {
            const escapedMainSelector = escapeSelector(mainSelector);
            const element = document.querySelector(escapedMainSelector);
            if (element) return element;
        } catch (e) {
            console.log(`Error with main selector "${mainSelector}":`, e);
        }
    }

    // Try fallback selectors in order
    for (const selector of fallbackSelectors) {
        try {
            if (selector.includes(',')) {
                const selectorParts = selector.split(',').map(part => part.trim());
                for (const part of selectorParts) {
                    const escapedPart = escapeSelector(part);
                    const element = document.querySelector(escapedPart);
                    if (element) return element;
                }
            } else {
                const escapedSelector = escapeSelector(selector);
                const element = document.querySelector(escapedSelector);
                if (element) return element;
            }
        } catch (e) {
            console.log(`Error with fallback selector "${selector}":`, e);
        }
    }

    // If no element found with escaped selectors, try alternative approaches
    if (mainSelector.includes('name=')) {
        const nameMatch = mainSelector.match(/name=['"]([^'"]+)['"]/);
        if (nameMatch) {
            const element = document.querySelector(`input[name='${nameMatch[1]}']`);
            if (element) return element;
        }
    }

    // Try by aria-label if present in selector
    if (mainSelector.includes('aria-label')) {
        const ariaMatch = mainSelector.match(/aria-label\*=['"]([^'"]+)['"]/);
        if (ariaMatch) {
            const element = document.querySelector(`input[aria-label*='${ariaMatch[1]}']`);
            if (element) return element;
        }
    }

    return null;
}

// Function to autofill form fields
function autofillForm(mappings, userData) {
    console.log('Raw userData received:', userData);
    
    // Parse name components if fullName is available
    const nameComponents = parseFullName(userData.fullName);
    const enhancedUserData = {
        // Add any additional fields from userData first
        ...userData,
        
        // Profile data (takes precedence over spread data)
        firstName: userData.firstName || nameComponents.firstName || '',
        middleName: userData.middleName || nameComponents.middleName || '',
        lastName: userData.lastName || nameComponents.lastName || '',
        fullName: userData.fullName || '',
        email: userData.email || '',
        linkedinUrl: userData.linkedinUrl || '',
        phone: userData.phone || '',
        phoneCountry: userData.phoneCountry || '',
        fullPhoneNumber: userData.fullPhoneNumber || '',
        
        // Resume data
        resume: userData.resume || null,
        resumeFileName: userData.resumeFileName || null,
        parsedResumeContent: userData.parsedResumeContent || ''
    };

    console.log('Enhanced user data for form filling:', {
        ...enhancedUserData,
        resume: enhancedUserData.resume ? 'Present' : 'Not present',
        parsedResumeContent: enhancedUserData.parsedResumeContent ? 'Present' : 'Not present'
    });

    // Helper function to trigger all necessary events
    function triggerAllEvents(element) {
        try {
            // Create and dispatch events
            const events = [
                new Event('input', { bubbles: true, cancelable: true }),
                new Event('change', { bubbles: true, cancelable: true }),
                new Event('blur', { bubbles: true, cancelable: true }),
                new InputEvent('input', { 
                    bubbles: true, 
                    cancelable: true,
                    inputType: 'insertText',
                    data: element.value
                })
            ];

            // Dispatch all events
            events.forEach(event => {
                try {
                    element.dispatchEvent(event);
                } catch (e) {
                    console.log(`Failed to dispatch ${event.type} event:`, e);
                }
            });

            // For React/Vue controlled inputs
            try {
                if (element._valueTracker) {
                    element._valueTracker.setValue('');
                }
                // Additional React-specific handling
                if (element._wrapperState) {
                    element._wrapperState.initialValue = element.value;
                }
            } catch (e) {
                console.log('React/Vue value tracker failed:', e);
            }

            // Try to trigger native events
            try {
                if (typeof element.focus === 'function') element.focus();
                if (typeof element.click === 'function') element.click();
                if (typeof element.blur === 'function') element.blur();
            } catch (e) {
                console.log('Native event triggers failed:', e);
            }
        } catch (error) {
            console.error('Error in triggerAllEvents:', error);
        }
    }

    // Helper function to set value with multiple approaches
    function setFieldValue(element, value) {
        try {
            // Special handling for file inputs
            if (element.type === 'file') {
                console.log('Handling file input element');
                // File inputs can't have their value set directly
                // Instead, we'll handle this in the file upload section
                return;
            }

            // For React/Vue controlled inputs
            const lastValue = element.value;
            
            // Method 1: Native value assignment
            element.value = value;
            
            // Method 2: React specific
            const reactProps = Object.getOwnPropertyDescriptor(element, 'props');
            if (reactProps && reactProps.value) {
                reactProps.value = value;
            }

            // Method 3: Using defineProperty
            try {
                Object.defineProperty(element, 'value', {
                    get: function() { return value; },
                    set: function(v) { value = v; },
                    configurable: true
                });
            } catch (e) {
                console.log('defineProperty failed:', e);
            }

            // Method 4: Using prototype setter (fixed to maintain proper 'this' binding)
            try {
                const prototype = Object.getPrototypeOf(element);
                const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
                if (descriptor && descriptor.set) {
                    descriptor.set.apply(element, [value]);
                }
            } catch (e) {
                console.log('Prototype setter failed:', e);
            }

            // Trigger React's change tracking
            if (element._valueTracker) {
                element._valueTracker.setValue(lastValue);
            }

            // Create and dispatch events
            const events = [
                new Event('input', { bubbles: true, composed: true }),
                new Event('change', { bubbles: true, composed: true }),
                new InputEvent('input', { 
                    bubbles: true,
                    composed: true,
                    inputType: 'insertText',
                    data: value
                }),
                new Event('blur', { bubbles: true, composed: true })
            ];

            // Dispatch all events
            events.forEach(event => {
                element.dispatchEvent(event);
            });

            // For React synthetic events
            if (element.dispatchEvent) {
                const nativeInputEvent = new InputEvent('input', {
                    bubbles: true,
                    cancelable: true,
                    composed: true,
                    inputType: 'insertText',
                    data: value,
                    isComposing: false
                });
                
                const nativeChangeEvent = new Event('change', {
                    bubbles: true,
                    cancelable: true,
                    composed: true
                });

                element.dispatchEvent(nativeInputEvent);
                element.dispatchEvent(nativeChangeEvent);
            }

            // Try simulating user input
            if (element.type !== 'hidden') {
                element.focus();
                element.select();
            }
            
            // For stubborn fields, try setting again after a delay
            setTimeout(() => {
                if (element.type !== 'file') {
                    element.value = value;
                    element.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
                    element.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
                }
            }, 100);

            // One final attempt for really stubborn fields
            setTimeout(() => {
                if (element.value !== value && element.type !== 'file') {
                    element.value = value;
                    element.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
                    element.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
                    element.blur();
                }
            }, 500);

        } catch (error) {
            console.error('Error in setFieldValue:', error);
            // Last resort: simple value setting
            try {
                if (element.type !== 'file') {
                    element.value = value;
                    element.dispatchEvent(new Event('change', { bubbles: true }));
                }
            } catch (e) {
                console.error('Even simple value setting failed:', e);
            }
        }
    }

    // Handle field mappings
    if (mappings.fieldMappings) {
        console.log('Processing field mappings:', mappings.fieldMappings);
        Object.entries(mappings.fieldMappings).forEach(([key, mapping]) => {
            try {
                console.log(`Processing field mapping for key "${key}":`, mapping);
                const element = findElementBySelectors(mapping.selector, mapping.fallbackSelectors);
                if (!element) {
                    console.log(`Element not found for mapping: ${key}`);
                    return;
                }

                let valueToFill = mapping.value;
                console.log(`Initial valueToFill for ${key}:`, valueToFill);
                
                // Skip null values if there's a corresponding question
                if (valueToFill === null && mappings.questions) {
                    const matchingQuestion = mappings.questions.find(q => 
                        q.selector === mapping.selector || 
                        (q.fallbackSelectors && q.fallbackSelectors.includes(mapping.selector))
                    );
                    if (matchingQuestion) {
                        console.log(`Skipping null field mapping as it has a question handler: ${key}`);
                        return;
                    }
                }

                if (typeof valueToFill === 'string') {
                    if (valueToFill.startsWith('userData.')) {
                        // Check if it's a concatenation expression
                        if (valueToFill.includes('+')) {
                            const parts = valueToFill.split('+').map(part => {
                                const key = part.trim().replace('userData.', '');
                                return enhancedUserData[key] || '';
                            });
                            valueToFill = parts.join('');
                            console.log('Concatenated value:', valueToFill);
                        } else {
                            const userDataKey = valueToFill.replace('userData.', '');
                            console.log(`Looking up userData key "${userDataKey}" for field "${key}"`);
                            console.log('Available userData keys:', Object.keys(enhancedUserData));
                            valueToFill = enhancedUserData[userDataKey];
                            console.log(`Found value for ${userDataKey}:`, valueToFill);
                            
                            // Special handling for empty strings that should have values
                            if (valueToFill === '' && userData[userDataKey]) {
                                console.log(`Empty string detected for ${userDataKey}, using original userData value:`, userData[userDataKey]);
                                valueToFill = userData[userDataKey];
                            }
                        }
                    } else {
                        console.log(`Using direct value for ${key}:`, valueToFill);
                    }
                }

                if (valueToFill !== undefined && valueToFill !== null && valueToFill !== '') {
                    console.log(`Setting value for field ${key}:`, valueToFill);
                    setFieldValue(element, valueToFill);
                    console.log(`Successfully filled field ${key} with value:`, valueToFill);
                } else {
                    console.log(`No value to fill for field ${key}. Value was:`, valueToFill);
                }
            } catch (error) {
                console.error(`Error filling field ${key}:`, error);
            }
        });
    }

    // Handle questions and answers
    if (mappings.questions) {
        console.log('Processing questions:', mappings.questions);
        mappings.questions.forEach(qa => {
            try {
                // Skip questions without selectors
                if (!qa.selector) {
                    console.log(`No selector for question: ${qa.question}`);
                    return;
                }

                const element = findElementBySelectors(qa.selector, qa.fallbackSelectors);
                if (!element) {
                    console.log(`Question field not found for: ${qa.question}`);
                    return;
                }

                if (qa.answer && qa.answer !== 'N/A') {
                    setFieldValue(element, qa.answer);
                    console.log(`Successfully filled question "${qa.question}" with answer:`, qa.answer);
                } else {
                    console.log(`No valid answer for question: ${qa.question}`);
                }
            } catch (error) {
                console.error(`Error filling question "${qa.question}":`, error);
            }
        });
    }

    // Handle file uploads
    if (mappings.fileUploads) {
        mappings.fileUploads.forEach(upload => {
            try {
                const element = findElementBySelectors(upload.selector, upload.fallbackSelectors);
                if (!element) {
                    console.log(`File upload field not found for: ${upload.type}`);
                    return;
                }

                if (upload.type === 'resume' && enhancedUserData.resume) {
                    console.log('Attempting to upload resume file...');
                    
                    // Convert base64 to Blob
                    const base64Data = enhancedUserData.resume;
                    const blob = dataURItoBlob(base64Data);
                    
                    // Create File object
                    const fileName = enhancedUserData.resumeFileName || 'resume.pdf';
                    const file = new File([blob], fileName, { type: 'application/pdf' });
                    
                    // Create a DataTransfer object
                    const dataTransfer = new DataTransfer();
                    dataTransfer.items.add(file);
                    
                    // Set the files property
                    try {
                        element.files = dataTransfer.files;
                        console.log('Set files property successfully');
                    } catch (e) {
                        console.error('Error setting files property:', e);
                    }
                    
                    // Dispatch necessary events
                    try {
                        element.dispatchEvent(new Event('change', { bubbles: true }));
                        element.dispatchEvent(new Event('input', { bubbles: true }));
                        
                        // For React file inputs
                        if (element._valueTracker) {
                            element._valueTracker.setValue(Math.random().toString());
                        }
                        
                        // Try to trigger the native file input change
                        if (typeof element.onchange === 'function') {
                            element.onchange({ target: element });
                        }
                    } catch (e) {
                        console.error('Error dispatching file input events:', e);
                    }
                    
                    console.log(`Successfully uploaded resume file: ${fileName}`);
                } else {
                    console.log('No resume data available for upload');
                }
            } catch (error) {
                console.error(`Error handling file upload ${upload.type}:`, error);
            }
        });
    }
}

// Helper function to convert data URI to Blob with better error handling
function dataURItoBlob(dataURI) {
    try {
        // Check if it's already a blob or file
        if (dataURI instanceof Blob) return dataURI;
        if (dataURI instanceof File) return dataURI;

        // Handle base64 data URI
        if (typeof dataURI === 'string' && dataURI.startsWith('data:')) {
            const arr = dataURI.split(',');
            const mime = arr[0].match(/:(.*?);/)[1];
            const bstr = atob(arr[1]);
            let n = bstr.length;
            const u8arr = new Uint8Array(n);
            while (n--) {
                u8arr[n] = bstr.charCodeAt(n);
            }
            return new Blob([u8arr], { type: mime });
        }

        // Handle raw base64 string
        if (typeof dataURI === 'string') {
            const bstr = atob(dataURI);
            const n = bstr.length;
            const u8arr = new Uint8Array(n);
            for (let i = 0; i < n; i++) {
                u8arr[i] = bstr.charCodeAt(i);
            }
            return new Blob([u8arr], { type: 'application/pdf' });
        }

        throw new Error('Invalid data URI format');
    } catch (error) {
        console.error('Error converting data URI to Blob:', error);
        return null;
    }
}


function extractPageContent() {
    const bodyInnerText = document.body.innerText; // Full page innerText
    return bodyInnerText;
  }

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'ping') {
        sendResponse({ success: true });
        return true;
    }
    
    if (request.action === 'triggerAutofill') {
        // Prevent multiple simultaneous executions
        if (isProcessing) {
            console.log('Already processing an autofill request, skipping...');
            sendResponse({ 
                success: false, 
                error: 'An autofill request is already in progress. Please wait.' 
            });
            return true;
        }

        // Implement debounce
        const now = Date.now();
        if (now - lastProcessTime < DEBOUNCE_DELAY) {
            console.log('Debouncing autofill request...');
            sendResponse({ 
                success: false, 
                error: 'Please wait a moment before trying again.' 
            });
            return true;
        }

        isProcessing = true;
        lastProcessTime = now;
        
        console.log('Received autofill request:', request);
        const formContent = extractFormContent();
        
        // Get user data
        chrome.runtime.sendMessage({ action: 'getUserData' }, async (userDataResponse) => {
            if (!userDataResponse.success || !userDataResponse.data) {
                isProcessing = false;
                sendResponse({ success: false, error: 'No user data found' });
                return;
            }

            const payload = {
                action: 'analyzeJobPage',
                pageContent: extractPageContent(),
                formData: {
                    fields: formContent.fields
                },
                userData: {
                    // Profile data (takes precedence)
                    firstName: userDataResponse.data.firstName,
                    middleName: userDataResponse.data.middleName,
                    lastName: userDataResponse.data.lastName,
                    fullName: userDataResponse.data.fullName,
                    email: userDataResponse.data.email,
                    phone: userDataResponse.data.phone,
                    phoneCountry: userDataResponse.data.phoneCountry,
                    linkedinUrl: userDataResponse.data.linkedinUrl,
                    // Resume data
                    resume: userDataResponse.data.resume,
                    resumeFileName: userDataResponse.data.resumeFileName,
                    
                    // Include parsed resume content for LLM context
                    resumeContent: userDataResponse.data.parsedResumeContent || 'No resume content available'
                }
            };
            
            console.log('Sending payload to LLM:', {
                pageContent: payload.pageContent.substring(0, 200) + '...',
                formFields: payload.formData.fields,
                profileData: {
                    firstName: payload.userData.firstName,
                    lastName: payload.userData.lastName,
                    email: payload.userData.email,
                    hasResume: !!payload.userData.resume,
                    linkedinUrl: payload.userData.linkedinUrl,
                    phone: payload.userData.phone,
                    phoneCountry: payload.userData.phoneCountry
                },
                resumeContent: (payload.userData.resumeContent || '').substring(0, 200) + '...'
            });
            
            // Analyze the page with Gemini
            chrome.runtime.sendMessage(payload, (geminiResponse) => {
                console.log('Raw Gemini Response:', geminiResponse);
                
                if (!geminiResponse.success) {
                    isProcessing = false;
                    console.error('API Error:', geminiResponse.error);
                    sendResponse({ success: false, error: geminiResponse.error });
                    return;
                }

                const data = geminiResponse.data;

                // Check for model overload error
                if (data.code === 503 && data.status === 'UNAVAILABLE') {
                    isProcessing = false;
                    console.error('Model overload error:', data);
                    const errorMessage = 'The AI model is currently busy. Please wait a few seconds and try again. 🔄';
                    showFloatingNotification(errorMessage);
                    sendResponse({ 
                        success: false, 
                        error: errorMessage,
                        isModelOverloaded: true
                    });
                    return;
                }

                // Check for error in the response
                if (data.error) {
                    isProcessing = false;
                    console.error('Gemini API error:', data.error);
                    sendResponse({ 
                        success: false, 
                        error: `API Error: ${data.error.message || 'Unknown error occurred'}`,
                    });
                    return;
                }

                // Validate response structure
                if (!data.candidates || !Array.isArray(data.candidates) || data.candidates.length === 0) {
                    isProcessing = false;
                    console.error('Invalid response structure:', data);
                    sendResponse({ 
                        success: false, 
                        error: 'Invalid response from AI model. Please try again.',
                    });
                    return;
                }

                const candidate = data.candidates[0];
                if (!candidate.content || !candidate.content.parts || !candidate.content.parts[0]) {
                    isProcessing = false;
                    console.error('Invalid candidate structure:', candidate);
                    sendResponse({ 
                        success: false, 
                        error: 'Invalid response format from AI model. Please try again.',
                    });
                    return;
                }

                // Extract the JSON from the response text
                const responseText = candidate.content.parts[0].text;
                console.log('Response text:', responseText);

                try {
                    // Extract JSON from code block if present
                    let jsonStr = responseText;
                    const codeBlockMatch = responseText.match(/```(?:json)?\n([\s\S]*?)\n```/);
                    if (codeBlockMatch) {
                        jsonStr = codeBlockMatch[1];
                    }

                    // Parse the JSON
                    const formMappings = JSON.parse(jsonStr);
                    console.log('Parsed form mappings:', formMappings);

                    // Validate the required structure
                    if (!formMappings.fieldMappings && !formMappings.questions && !formMappings.fileUploads) {
                        isProcessing = false;
                        throw new Error('Missing required mapping sections');
                    }

                    // Execute the form filling
                    try {
                        autofillForm(formMappings, payload.userData);
                        isProcessing = false;
                        sendResponse({ success: true });
                    } catch (fillError) {
                        isProcessing = false;
                        console.error('Error filling form:', fillError);
                        sendResponse({ 
                            success: false, 
                            error: 'Error filling form: ' + fillError.message 
                        });
                    }
                } catch (parseError) {
                    isProcessing = false;
                    console.error('Error parsing LLM response:', parseError);
                    console.error('Raw response:', responseText);
                    sendResponse({ 
                        success: false, 
                        error: 'Error parsing AI response: ' + parseError.message 
                    });
                }
            });
        });
        
        return true; // Required for async sendResponse
    }
});

// Add cleanup on page unload
window.addEventListener('unload', () => {
    isProcessing = false;
});

// Helper function to show floating notification
function showFloatingNotification(message) {
    // Create and show a floating notification
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background-color: #FEF3C7;
        color: #92400E;
        padding: 16px 24px;
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        z-index: 10000;
        font-family: system-ui, -apple-system, sans-serif;
        display: flex;
        align-items: center;
        gap: 12px;
        max-width: 400px;
        animation: slideIn 0.3s ease-out;
    `;
    
    notification.innerHTML = `
        <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        <div>
            <div style="font-weight: 600; margin-bottom: 4px;">AI Model Busy</div>
            <div style="font-size: 14px;">${message}</div>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Add animation styles
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
    
    // Remove the notification after 5 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
    }, 5000);
}