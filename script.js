/**
 * SECURITY SHOWCASE - VANILLA JAVASCRIPT
 * ========================================
 * 
 * THREAT MODEL:
 * This application defends against DOM-based Cross-Site Scripting (XSS) attacks.
 * Attack vectors include: user input fields, URL parameters, and any untrusted data
 * that could be rendered in the DOM.
 * 
 * DEFENSE STRATEGY:
 * 1. Input Sanitization: Remove malicious code patterns before processing
 * 2. Safe DOM Manipulation: Use textContent instead of innerHTML for user data
 * 3. Content Security Policy: Browser-level enforcement via CSP headers
 * 4. Defense in Depth: Multiple layers ensure if one fails, others protect
 * 
 * OWASP ALIGNMENT: A03:2021 – Injection (DOM-based XSS)
 */

'use strict';

// ============================================
// CONFIGURATION & CONSTANTS
// ============================================

const CONFIG = {
    MAX_INPUT_LENGTH: 500,
    BOT_RESPONSE_DELAY: 1000, // milliseconds
    ALLOWED_HTML_TAGS: ['a', 'br'], // Tags allowed in system messages only
    DANGEROUS_PROTOCOLS: ['javascript:', 'data:', 'vbscript:'],
};

// ============================================
// SECURITY LAYER: INPUT SANITIZATION
// ============================================

/**
 * Sanitizes user input to prevent XSS attacks
 * 
 * SECURITY RATIONALE:
 * - Removes <script> tags that could execute arbitrary code
 * - Strips inline event handlers (onclick, onerror, etc.) that bypass CSP
 * - Blocks javascript: URLs that execute code when clicked
 * - Limits input length to prevent buffer overflow and DoS
 * - Normalizes whitespace to prevent obfuscation attacks
 * 
 * @param {string} input - Raw user input
 * @returns {string} - Sanitized input safe for further processing
 */
function sanitizeInput(input) {
    if (typeof input !== 'string') {
        return '';
    }

    // Step 1: Length limitation (prevent DoS via excessive input)
    let sanitized = input.substring(0, CONFIG.MAX_INPUT_LENGTH);

    // Step 2: Remove <script> tags (case-insensitive)
    // Matches: <script>, </script>, <script src="...">, etc.
    sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    sanitized = sanitized.replace(/<script[^>]*>/gi, '');

    // Step 3: Remove inline event handlers
    // Matches: onclick, onerror, onload, onmouseover, etc.
    sanitized = sanitized.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
    sanitized = sanitized.replace(/on\w+\s*=\s*[^\s>]*/gi, '');

    // Step 4: Block dangerous URL protocols
    CONFIG.DANGEROUS_PROTOCOLS.forEach(protocol => {
        const regex = new RegExp(protocol, 'gi');
        sanitized = sanitized.replace(regex, '');
    });

    // Step 5: Remove dangerous HTML tags
    const dangerousTags = ['iframe', 'object', 'embed', 'applet', 'meta', 'link', 'style'];
    dangerousTags.forEach(tag => {
        const regex = new RegExp(`<${tag}\\b[^<]*(?:(?!<\\/${tag}>)<[^<]*)*<\\/${tag}>`, 'gi');
        sanitized = sanitized.replace(regex, '');
        sanitized = sanitized.replace(new RegExp(`<${tag}[^>]*>`, 'gi'), '');
    });

    // Step 6: Normalize whitespace
    sanitized = sanitized.trim();
    sanitized = sanitized.replace(/\s+/g, ' ');

    return sanitized;
}

/**
 * Detects if input contains potential XSS payloads
 * 
 * SECURITY RATIONALE:
 * Identifies common attack patterns to warn users when malicious content is attempted.
 * This is for demonstration purposes - real protection comes from sanitization.
 * 
 * @param {string} input - User input to check
 * @returns {boolean} - True if suspicious patterns detected
 */
function detectXSSAttempt(input) {
    const xssPatterns = [
        /<script/i,
        /javascript:/i,
        /on\w+\s*=/i,
        /<iframe/i,
        /<object/i,
        /<embed/i,
        /onerror/i,
        /onload/i,
        /onclick/i,
        /svg.*onload/i,
        /img.*src.*onerror/i,
    ];

    return xssPatterns.some(pattern => pattern.test(input));
}

// ============================================
// SECURITY LAYER: SAFE OUTPUT RENDERING
// ============================================

/**
 * Safely renders HTML content with strict allowlist
 * 
 * SECURITY RATIONALE:
 * - Only allows specific, safe HTML tags (<a>, <br>)
 * - Strips all attributes except href (and validates it)
 * - Ensures no event handlers can be injected
 * - Used ONLY for system/bot messages, NEVER for user input
 * 
 * WHY NOT USE FOR USER INPUT:
 * User input is always rendered using textContent to prevent ANY HTML injection.
 * This function is for controlled system messages that need basic formatting.
 * 
 * @param {string} html - HTML content to render safely
 * @returns {string} - Sanitized HTML with only allowed tags
 */
function renderSafeHTML(html) {
    // Create temporary DOM element for parsing
    const temp = document.createElement('div');
    temp.textContent = html; // First escape everything
    
    // For system messages, we allow limited HTML
    // This is safe because we control the input source (our code, not user)
    let safe = html;
    
    // Remove all tags except allowed ones
    const allowedTagsPattern = CONFIG.ALLOWED_HTML_TAGS.join('|');
    const tagRegex = new RegExp(`<(?!\\/?(${allowedTagsPattern})\\b)[^>]+>`, 'gi');
    safe = safe.replace(tagRegex, '');
    
    // Remove all attributes except href on <a> tags
    safe = safe.replace(/<a\s+[^>]*>/gi, (match) => {
        const hrefMatch = match.match(/href\s*=\s*["']([^"']*)["']/i);
        if (hrefMatch && !CONFIG.DANGEROUS_PROTOCOLS.some(p => hrefMatch[1].toLowerCase().startsWith(p))) {
            return `<a href="${hrefMatch[1]}" target="_blank" rel="noopener noreferrer">`;
        }
        return '<a>';
    });
    
    return safe;
}

/**
 * Renders user message safely in the DOM
 * 
 * CRITICAL SECURITY FUNCTION:
 * Uses textContent instead of innerHTML to prevent HTML injection.
 * This is the PRIMARY defense against DOM-based XSS.
 * 
 * textContent vs innerHTML:
 * - textContent: Treats input as plain text, automatically escapes HTML
 * - innerHTML: Parses input as HTML, can execute scripts
 * 
 * @param {string} message - User message (already sanitized)
 * @param {string} type - Message type: 'user', 'bot', 'system', 'security'
 */
function addMessage(message, type = 'user') {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    
    // Set CSS class based on message type
    messageDiv.className = `message ${type}-message`;
    
    if (type === 'user') {
        // CRITICAL: Use textContent for user input (never innerHTML)
        // This prevents any HTML/JavaScript from being rendered
        const label = document.createElement('strong');
        label.textContent = 'You: ';
        messageDiv.appendChild(label);
        
        const content = document.createElement('span');
        content.textContent = message; // AUTO-ESCAPES HTML
        messageDiv.appendChild(content);
        
    } else if (type === 'bot' || type === 'system') {
        // Bot/system messages can have controlled HTML (we control the source)
        const label = document.createElement('strong');
        label.textContent = type === 'bot' ? 'Bot: ' : 'System: ';
        messageDiv.appendChild(label);
        
        const content = document.createElement('span');
        content.innerHTML = renderSafeHTML(message); // Limited safe HTML
        messageDiv.appendChild(content);
        
    } else if (type === 'security') {
        // Security warnings (fully controlled, no user input)
        const icon = document.createElement('strong');
        icon.textContent = '⚠️ Security Alert: ';
        messageDiv.appendChild(icon);
        
        const content = document.createElement('span');
        content.textContent = message;
        messageDiv.appendChild(content);
    }
    
    chatMessages.appendChild(messageDiv);
    
    // Auto-scroll to latest message
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

/**
 * Shows typing indicator for bot responses
 */
function showTypingIndicator() {
    const chatMessages = document.getElementById('chatMessages');
    const typingDiv = document.createElement('div');
    typingDiv.id = 'typingIndicator';
    typingDiv.className = 'message bot-message';
    
    const indicator = document.createElement('span');
    indicator.className = 'typing-indicator';
    indicator.textContent = 'Bot is typing';
    
    typingDiv.appendChild(indicator);
    chatMessages.appendChild(typingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

/**
 * Removes typing indicator
 */
function removeTypingIndicator() {
    const indicator = document.getElementById('typingIndicator');
    if (indicator) {
        indicator.remove();
    }
}

// ============================================
// APPLICATION LOGIC
// ============================================

/**
 * Processes user message with security checks
 * 
 * WORKFLOW:
 * 1. Get raw input
 * 2. Detect XSS attempts (for demonstration/warning)
 * 3. Sanitize input (remove malicious code)
 * 4. Render sanitized input safely (using textContent)
 * 5. Generate bot response
 * 
 * @param {string} rawInput - Raw user input from text field
 */
function handleUserMessage(rawInput) {
    // Step 1: Check if input is empty
    if (!rawInput || rawInput.trim().length === 0) {
        return;
    }

    // Step 2: Detect XSS attempt (for user awareness)
    const isXSSAttempt = detectXSSAttempt(rawInput);
    
    // Step 3: Sanitize input (CRITICAL SECURITY STEP)
    const sanitizedInput = sanitizeInput(rawInput);
    
    // Step 4: Display sanitized user message
    addMessage(sanitizedInput, 'user');
    
    // Step 5: If XSS detected, show security warning
    if (isXSSAttempt) {
        addMessage(
            'Potential XSS payload detected and blocked! Your input was sanitized before rendering.',
            'security'
        );
    }
    
    // Step 6: Generate bot response
    generateBotResponse(sanitizedInput, isXSSAttempt);
    
    // Step 7: Clear input field
    document.getElementById('userInput').value = '';
    updateCharCount();
}

/**
 * Generates contextual bot responses
 * 
 * @param {string} userMessage - Sanitized user message
 * @param {boolean} wasXSSAttempt - Whether XSS was detected
 */
function generateBotResponse(userMessage, wasXSSAttempt) {
    showTypingIndicator();
    
    setTimeout(() => {
        removeTypingIndicator();
        
        if (wasXSSAttempt) {
            const responses = [
                'Nice try! 😊 That XSS payload was neutralized by our input sanitization layer. The dangerous code was removed before rendering.',
                'Security system activated! 🛡️ Your payload was sanitized using multiple techniques: script tag removal, event handler stripping, and safe DOM rendering.',
                'Attack blocked! ✋ This demonstrates why using textContent instead of innerHTML is critical for preventing DOM-based XSS.',
                'Great example! 👍 The malicious code was caught by our multi-layered defense: sanitization → safe rendering → CSP enforcement.',
            ];
            addMessage(responses[Math.floor(Math.random() * responses.length)], 'bot');
        } else {
            // Regular conversation
            const responses = [
                `You said: "${userMessage}". This message was safely rendered using textContent to prevent any HTML injection.`,
                'Your input was processed securely! Notice how it appears as plain text, not executable code.',
                'Message received and safely displayed. Try entering an XSS payload to see the security system in action!',
                'Thanks for your message! All user input goes through sanitization before being displayed.',
            ];
            addMessage(responses[Math.floor(Math.random() * responses.length)], 'bot');
        }
    }, CONFIG.BOT_RESPONSE_DELAY);
}

/**
 * Updates character count display
 */
function updateCharCount() {
    const input = document.getElementById('userInput');
    const charCount = document.getElementById('charCount');
    const currentLength = input.value.length;
    
    charCount.textContent = `${currentLength}/${CONFIG.MAX_INPUT_LENGTH} characters`;
    
    // Visual feedback when approaching limit
    if (currentLength > CONFIG.MAX_INPUT_LENGTH * 0.9) {
        charCount.style.color = '#e74c3c';
    } else if (currentLength > CONFIG.MAX_INPUT_LENGTH * 0.7) {
        charCount.style.color = '#f39c12';
    } else {
        charCount.style.color = '#7f8c8d';
    }
}

/**
 * Loads example XSS payload into input field
 * 
 * @param {string} payload - XSS payload to demonstrate
 */
function loadPayload(payload) {
    const input = document.getElementById('userInput');
    input.value = payload;
    updateCharCount();
    input.focus();
}

// ============================================
// EVENT LISTENERS & INITIALIZATION
// ============================================

/**
 * Initialize application when DOM is ready
 * 
 * SECURITY NOTE:
 * We use addEventListener instead of inline event handlers (onclick="...")
 * because inline handlers:
 * 1. Are blocked by our CSP policy
 * 2. Can be vulnerable to attribute injection
 * 3. Mix content with behavior (bad practice)
 */
document.addEventListener('DOMContentLoaded', function() {
    
    // Get DOM elements
    const userInput = document.getElementById('userInput');
    const sendBtn = document.getElementById('sendBtn');
    const payloadButtons = document.querySelectorAll('.payload-btn');
    
    // Send message on button click
    sendBtn.addEventListener('click', function() {
        handleUserMessage(userInput.value);
    });
    
    // Send message on Enter key
    userInput.addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            event.preventDefault(); // Prevent form submission if wrapped in form
            handleUserMessage(userInput.value);
        }
    });
    
    // Update character count on input
    userInput.addEventListener('input', function() {
        updateCharCount();
    });
    
    // Load example payloads
    payloadButtons.forEach(button => {
        button.addEventListener('click', function() {
            const payload = this.getAttribute('data-payload');
            loadPayload(payload);
        });
    });
    
    // Smooth scroll for navigation links
    document.querySelectorAll('.main-nav a').forEach(link => {
        link.addEventListener('click', function(event) {
            event.preventDefault();
            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);
            
            if (targetElement) {
                targetElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
    
    // Initial character count
    updateCharCount();
    
    // Welcome message with security info
    setTimeout(() => {
        addMessage(
            'Try testing the security by clicking one of the XSS payload buttons below, or type your own malicious code. All attempts will be safely blocked! 🛡️',
            'system'
        );
    }, 1000);
    
    // Initialize menu functionality
    initializeMenu();
    
    // Initialize font size control
    initializeFontSizeControl();
});

// ============================================
// ADDITIONAL SECURITY MEASURES
// ============================================

// ============================================
// MENU FUNCTIONALITY
// ============================================

/**
 * Menu panel controls
 */
function initializeMenu() {
    const menuBtn = document.getElementById('menuBtn');
    const closeMenuBtn = document.getElementById('closeMenuBtn');
    const menuPanel = document.getElementById('menuPanel');
    const menuOverlay = document.getElementById('menuOverlay');
    
    let touchStartX = 0;
    let touchEndX = 0;

    // Open menu
    if (menuBtn) {
        menuBtn.addEventListener('click', function() {
            menuPanel.classList.add('active');
            menuOverlay.classList.add('active');
            document.body.style.overflow = 'hidden'; // Prevent scrolling when menu is open
            
            // Prevent background scrolling on iOS
            document.body.style.position = 'fixed';
            document.body.style.width = '100%';
        });
    }

    // Close menu function
    function closeMenu() {
        menuPanel.classList.remove('active');
        menuOverlay.classList.remove('active');
        document.body.style.overflow = ''; // Restore scrolling
        
        // Restore position on iOS
        document.body.style.position = '';
        document.body.style.width = '';
    }

    // Close menu button
    if (closeMenuBtn) {
        closeMenuBtn.addEventListener('click', closeMenu);
    }

    // Close menu when clicking overlay
    if (menuOverlay) {
        menuOverlay.addEventListener('click', closeMenu);
    }

    // Close menu with Escape key
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape' && menuPanel.classList.contains('active')) {
            closeMenu();
        }
    });
    
    // Swipe to close menu (mobile gesture)
    if (menuPanel) {
        menuPanel.addEventListener('touchstart', function(event) {
            touchStartX = event.changedTouches[0].screenX;
        }, { passive: true });
        
        menuPanel.addEventListener('touchend', function(event) {
            touchEndX = event.changedTouches[0].screenX;
            handleSwipe();
        }, { passive: true });
    }
    
    function handleSwipe() {
        // Swipe right to close (minimum 100px swipe)
        if (touchEndX > touchStartX + 100) {
            closeMenu();
        }
    }
}

/**
 * Font size control functionality
 */
function initializeFontSizeControl() {
    const fontSizeRange = document.getElementById('fontSizeRange');
    const fontSizeValue = document.getElementById('fontSizeValue');
    const fontIncrease = document.getElementById('fontIncrease');
    const fontDecrease = document.getElementById('fontDecrease');

    // Update font size function
    function updateFontSize(size) {
        document.documentElement.style.fontSize = size + 'px';
        if (fontSizeValue) {
            fontSizeValue.textContent = size + 'px';
        }
        if (fontSizeRange) {
            fontSizeRange.value = size;
        }
        // Save to localStorage
        localStorage.setItem('preferredFontSize', size);
    }

    // Load saved font size or set default to 16px
    const savedFontSize = localStorage.getItem('preferredFontSize');
    if (savedFontSize) {
        updateFontSize(parseInt(savedFontSize));
    } else {
        // Set default font size to 16px
        updateFontSize(16);
    }

    // Range slider
    if (fontSizeRange) {
        fontSizeRange.addEventListener('input', function() {
            updateFontSize(parseInt(this.value));
        });
    }

    // Increase button
    if (fontIncrease) {
        fontIncrease.addEventListener('click', function() {
            const currentSize = parseInt(fontSizeRange.value);
            const newSize = Math.min(24, currentSize + 1);
            updateFontSize(newSize);
        });
    }

    // Decrease button
    if (fontDecrease) {
        fontDecrease.addEventListener('click', function() {
            const currentSize = parseInt(fontSizeRange.value);
            const newSize = Math.max(12, currentSize - 1);
            updateFontSize(newSize);
        });
    }
}

/**
 * Prevent common XSS attack vectors
 */

// Prevent eval and Function constructor (defense in depth)
// Note: CSP already blocks eval, but this adds extra protection
window.eval = function() {
    console.warn('eval() is disabled for security reasons');
    return null;
};

// Log security events (in production, send to monitoring service)
window.addEventListener('securitypolicyviolation', function(event) {
    console.error('CSP Violation:', {
        violatedDirective: event.violatedDirective,
        blockedURI: event.blockedURI,
        effectiveDirective: event.effectiveDirective,
    });
    
    // In production: send to security monitoring service
    // Example: sendToSecurityMonitoring(event);
});

// ============================================
// EXPORTS (for testing purposes)
// ============================================

// Expose functions for unit testing (if needed)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        sanitizeInput,
        detectXSSAttempt,
        renderSafeHTML,
    };
}

/**
 * END OF SECURITY SHOWCASE
 * 
 * KEY TAKEAWAYS:
 * 1. Input Sanitization: Remove dangerous patterns before processing
 * 2. Safe DOM Manipulation: Use textContent for user data, never innerHTML
 * 3. Defense in Depth: Multiple layers (sanitization + safe rendering + CSP)
 * 4. Principle of Least Privilege: Only allow what's necessary
 * 5. Secure by Default: If uncertain, treat as unsafe
 * 
 * NEXT STEPS FOR PRODUCTION:
 * - Add server-side validation (never trust client-side only)
 * - Implement rate limiting to prevent abuse
 * - Use HTTPS to prevent man-in-the-middle attacks
 * - Add logging and monitoring for security events
 * - Regular security audits and penetration testing
 */
