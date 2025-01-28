// Constants
const GEMINI_API_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'analyzeJobPage') {
        // Get the API key from storage
        chrome.storage.local.get(['apiKey'], function(result) {
            if (!result.apiKey) {
                sendResponse({ success: false, error: 'API key not found' });
                return;
            }
            
            const prompt = `
            You are a highly specialized AI expert trained to automate job applications. Your mission is to meticulously analyze job application forms and match them with a candidate's resume data to complete applications flawlessly. You must act as a helpful assistant guiding the applicant (invisibly) through the form.

            **Your Responsibilities:**

            1.  **Deconstruct the Application:** Thoroughly examine the job application page's HTML structure. Understand the fields, questions, layout, and any hidden logic.
            2.  **Bridge the Gap:** Intelligently map form fields to the applicant's profile data. This requires understanding the semantic meaning of each field and its corresponding information in the resume.
            3.  **Special Field Handling:**
                *   **Phone Numbers:** For phone number fields:
                    *   Use the user's fullPhoneNumber if available (this is already formatted with country code)
                    *   If the form has separate country code and phone fields, split fullPhoneNumber accordingly
                    *   Format the phone number according to the field's placeholder or pattern attribute
                    *   Common formats to handle: (XXX) XXX-XXXX, XXX-XXX-XXXX, XXXXXXXXXX
            4.  **Identify Current Employment:**  Determine the applicant's current company and job title from the resume.
                *   Look for experiences with an end date of "Present," "Current," or similar.
                *   If no "Present" end date is found, the most recent experience is likely the current one.
                *   Consider the context: job titles, descriptions, and dates should align to form a coherent career progression.
                *   **Prioritize identifying a current company even if the role is not explicitly labeled as "current" in the resume.**
            5.  **Uncover Every Question:** Identify ALL questions on the page. This includes explicitly stated questions (in labels, headings, etc.) AND questions implied within the context of the form fields or surrounding text.
            6.  **Craft Perfect Answers:** Generate answers to each question, as if the applicant were writing them. Answers MUST:
                *   Be phrased in the **first person**.
                *   Be derived directly from the provided resume content **where possible**.
                *   Be natural, concise, and professional.
                *   Avoid being conversational or including any filler words.
                *   Not include any question in the answer.
                *   **If there is no information explicitly provided in the resume for any question, provide a convincing and relevant answer by:**
                    *   **Inferring from related skills, experiences, or the applicant's education mentioned in the resume.**
                    *   **Using general knowledge and common sense to craft a response a human applicant might realistically provide.**
                    *   **For questions about notice periods or availability, assume standard professional practices (e.g., two-week notice) unless the resume indicates otherwise (e.g., currently unemployed). Express a willingness to be flexible if the context suggests it.**
                    *   **Only use "N/A" if the question is completely unanswerable through any of these methods and a realistic human response cannot be formulated.**
            7.  **Precise Selectors:** Generate highly accurate CSS/HTML selectors for each field and question on the page, following the strict guidelines below.

            **Page Content:**
            ${request.pageContent}

            **Form Fields:**
            ${JSON.stringify(request.formData.fields, null, 2)}

            **User Profile Data:** (Assume this is pre-filled from the resume if available)
            ${JSON.stringify(request.userData, null, 2)}

            **Resume Content:**
            ${request.userData.resumeContent}

            **Instructions:**
            You will be provided with the following:

            *   **Page Content:** The raw HTML source code of the job application page.
            *   **Form Fields:** A structured JSON representation of form fields, including their attributes (id, name, data-testid, etc.).
            *   **User Profile Data:** A JSON object representing the applicant's pre-filled profile information (if available). This could be partly populated from the resume.
            *   **Resume Content:** The full text content of the applicant's resume (or a clear indication that it will be provided later).

            **Output Format:**

            Your response MUST be a valid JSON object with this structure:

            JSON
            {
                "fieldMappings": {
                    "formFieldSelector1": {
                        "value": "userData.correspondingField",
                        "selector": "#firstName, input[name='firstName'], input[aria-label*='first name']",
                        "fallbackSelectors": [
                            "input[placeholder*='first name']",
                            "input[data-field='firstName']"
                        ]
                    },
                    "formFieldSelector2": {
                        "value": "userData.anotherField"
                        // ... more mappings
                    }
                },
                "questions": [
                    {
                        "question": "The exact, full text of the question as it appears on the page.",
                        "type": "textarea",
                        "selector": "The most specific CSS/HTML selector for the question's input field, derived from the Form Fields data.",
                        "fallbackSelectors": ["Array", "of", "alternative", "selectors"],
                        "answer": "The generated answer, phrased in the first person, based on the resume **or inferred from it. If no information is available in the resume, provide a realistic answer based on general knowledge and common sense.**"
                    }
                    // ... more questions
                ],
                "fileUploads": [
                    {
                        "type": "resume",
                        "selector": "input[type='file'][accept*='pdf']",
                        "fallbackSelectors": [
                            "input[type='file'][name*='resume']",
                            "input[type='file'][aria-label*='resume']"
                        ]
                    }
                ]
            }

            **Strict Selector Rules (ABSOLUTELY CRITICAL):**

            Data-Driven Selectors: Selectors MUST be primarily based on the attributes found in the provided Form Fields JSON data. Do not invent selectors; use what's actually present in the form's HTML.
            Priority Order: When constructing selectors, prioritize these attributes in the following order:
            id (e.g., #field-123)
            data-testid (e.g., [data-testid='input-custom_question_...'])
            name (e.g., [name='applicantEmail'])
            data-input or other data-* attributes (if unique)
            aria-label (if descriptive)
            class (ONLY if highly specific and likely unique to that field, e.g., a long, generated class name that is not used for any other elements on the form)
            Combined Selectors: For the selector field (the primary selector), combine the top 3 available attributes (id, data-testid, name) using commas. This creates a more robust selector. When dealing with fields related to the resume, make sure to include selectors for both the original and normalized (e.g., 'resume' and 'resume') versions of the name and label to account for potential variations in forms. Example: #field-58, [data-testid='input-unique-id'], [name='fieldName']
            Fallback Selectors: fallbackSelectors should explore other attributes (like data-input, class, aria-*), but ONLY if they are present in the Form Fields data for that specific field.
            Context is Key: If a question is clearly associated with a specific input field (e.g., a label directly above a text area), prioritize selectors that reflect this relationship.
            Specificity: Strive for the most specific selectors possible without making them brittle.
            Example of Correct Selector Generation:

            **Form Field Data:**
            JSON
            {
                "id": "field-58",
                "data-testid": "input-custom_question_22b021aa-400e-4771-91ce-06198b20d1ea",
                "name": "z5sqpcHDEhFf",
                "data-input": "custom_question_22b021aa-400e-4771-91ce-06198b20d1ea",
                "class": "css-18q21i6-Input",
                "aria-label": "Please describe your experience with remote work"
            }

            **Correct Selector:**
            JSON
            {
                "selector": "#field-58, [data-testid='input-custom_question_22b021aa-400e-4771-91ce-06198b20d1ea'], [name='z5sqpcHDEhFf']",
                "fallbackSelectors": [
                    "[data-input='custom_question_22b021aa-400e-4771-91ce-06198b20d1ea']",
                    ".css-18q21i6-Input",
                    "[aria-label='Please describe your experience with remote work']"
                ]
            }

            **Example of a Complete Question Mapping:**
            JSON
            {
                "questions": [
                    {
                        "question": "Do you have experience working remotely?",
                        "type": "text",
                        "selector": "#field-58, [data-testid='input-custom_question_22b021aa-400e-4771-91ce-06198b20d1ea'], [name='z5sqpcHDEhFf']",
                        "fallbackSelectors": [
                            "[data-input='custom_question_22b021aa-400e-4771-91ce-06198b20d1ea']",
                            ".css-18q21i6-Input",
                            "[aria-label='Please describe your experience with remote work']"
                        ],
                        "answer": "Yes, I have over three years of experience working remotely as a software engineer. In my previous role at Acme Corp, I was part of a fully distributed team, collaborating with colleagues across different time zones. I am proficient in using remote communication tools like Slack and Zoom, and I have a proven track record of delivering high-quality work in a remote environment."
                    }
                ]
            }

            **Absolutely Non-Negotiable Rules:**

            NEVER create selectors without a direct match in the Form Fields data.
            ALWAYS use the exact attribute values from the provided Form Fields.
            Questions MUST perfectly align with their corresponding input fields based on the HTML structure and the Form Fields data.
            Answers MUST be generated from the resume **or inferred from it as described above, using a human-like approach**.
            Selectors MUST follow the priority order and combination rules.

            **Consequences of Violating the Rules:**

            Incorrect selectors or answers will lead to a malfunctioning application process, potentially causing the application to be rejected or misfiled. Your accuracy is paramount.

            **Final Notes:**

            This task requires extreme precision and attention to detail. Double-check every selector and answer. Your output will be directly used to fill out real job applications, so it must be reliable. Good luck!`;

            fetch(`${GEMINI_API_ENDPOINT}?key=${result.apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: prompt
                        }]
                    }]
                })
            })
            .then(response => response.json())
            .then(data => {
                // Send the raw response back to content.js
                sendResponse({ success: true, data });
            })
            .catch(error => {
                sendResponse({ 
                    success: false, 
                    error: error.message || 'Network error occurred'
                });
            });
        });

        return true; // Required for async sendResponse
    }

    if (request.action === 'getUserData') {
        chrome.storage.local.get(['userData'], function(result) {
            sendResponse({ success: true, data: result.userData });
        });
        return true;
    }
});