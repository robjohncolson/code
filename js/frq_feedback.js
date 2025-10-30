(function () {
    const CONSENT_KEY = 'frq_ai_feedback_consent_v1';
    const feedbackCache = new Map();
    let consentModal = null;
    let pendingConsentResolver = null;

    function ensureConsentModal() {
        if (consentModal) return consentModal;

        consentModal = document.createElement('div');
        consentModal.id = 'frq-consent-modal';
        consentModal.innerHTML = `
            <div class="frq-consent-backdrop" data-frq-consent="backdrop"></div>
            <div class="frq-consent-dialog" role="dialog" aria-labelledby="frq-consent-title" aria-modal="true">
                <div class="frq-consent-header">
                    <h3 id="frq-consent-title">AI Feedback Consent</h3>
                </div>
                <div class="frq-consent-body">
                    <p>
                        Your anonymous response and the question rubric will be sent to Google's AI (Gemini)
                        to generate feedback. No personal information is included.
                    </p>
                    <p>Do you consent to use this feature?</p>
                </div>
                <div class="frq-consent-actions">
                    <button type="button" class="frq-consent-button secondary" data-frq-consent="decline">Not now</button>
                    <button type="button" class="frq-consent-button" data-frq-consent="accept">I Consent</button>
                </div>
            </div>
        `;

        document.body.appendChild(consentModal);

        consentModal.addEventListener('click', (event) => {
            const target = event.target;
            if (!(target instanceof HTMLElement)) return;

            if (target.dataset.frqConsent === 'accept') {
                localStorage.setItem(CONSENT_KEY, 'granted');
                closeConsentModal();
                if (pendingConsentResolver) pendingConsentResolver(true);
            } else if (target.dataset.frqConsent === 'decline') {
                closeConsentModal();
                if (pendingConsentResolver) pendingConsentResolver(false);
            } else if (target.dataset.frqConsent === 'backdrop') {
                closeConsentModal();
                if (pendingConsentResolver) pendingConsentResolver(false);
            }
        });

        return consentModal;
    }

    function openConsentModal() {
        ensureConsentModal();
        if (!consentModal) return;
        consentModal.classList.add('show');
        const dialog = consentModal.querySelector('.frq-consent-dialog');
        if (dialog) {
            dialog.focus({ preventScroll: true });
        }
    }

    function closeConsentModal() {
        if (!consentModal) return;
        consentModal.classList.remove('show');
        pendingConsentResolver = null;
    }

    function ensureConsent() {
        if (localStorage.getItem(CONSENT_KEY) === 'granted') {
            return Promise.resolve(true);
        }

        return new Promise((resolve) => {
            pendingConsentResolver = resolve;
            openConsentModal();
        });
    }

    function escapeHtml(value) {
        if (value === null || value === undefined) return '';
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function renderRubricHtml(frqConfig, questionId) {
        if (!frqConfig || !frqConfig.rubric) return '';
        const rubric = frqConfig.rubric;
        let html = '';

        if (Array.isArray(rubric.scoreGuide)) {
            html += '<div class="frq-rubric-scale">';
            rubric.scoreGuide.forEach((level) => {
                if (!level) return;
                html += `
                    <div class="frq-rubric-level">
                        <div class="frq-rubric-level-score">${escapeHtml(level.score)}</div>
                        <div class="frq-rubric-level-body">
                            <div class="frq-rubric-level-label">${escapeHtml(level.label || '')}</div>
                            <div class="frq-rubric-level-text">${escapeHtml(level.description || '')}</div>
                        </div>
                    </div>
                `;
            });
            html += '</div>';
        }

        if (Array.isArray(rubric.criteria)) {
            html += '<div class="frq-rubric-criteria">';
            rubric.criteria.forEach((criterion) => {
                if (!criterion) return;
                html += `
                    <div class="frq-rubric-criterion">
                        <div class="frq-rubric-criterion-title">${escapeHtml(criterion.name || 'Criterion')}</div>
                `;
                if (Array.isArray(criterion.levels)) {
                    html += '<ul class="frq-rubric-level-list">';
                    criterion.levels.forEach((level) => {
                        if (!level) return;
                        html += `
                            <li>
                                <strong>${escapeHtml(level.score !== undefined ? `Score ${level.score}` : level.label || '')}:</strong>
                                <span>${escapeHtml(level.description || '')}</span>
                            </li>
                        `;
                    });
                    html += '</ul>';
                } else if (criterion.description) {
                    html += `<p>${escapeHtml(criterion.description)}</p>`;
                }
                html += '</div>';
            });
            html += '</div>';
        }

        return `
            <details class="frq-rubric-panel" id="frq-rubric-${escapeHtml(questionId)}">
                <summary>📋 View Rubric</summary>
                ${html}
            </details>
        `;
    }

    function findQuestion(questionId) {
        if (Array.isArray(window.currentQuestions)) {
            const match = window.currentQuestions.find((q) => q.id === questionId);
            if (match) return match;
        }
        if (Array.isArray(window.allUnitQuestions)) {
            const match = window.allUnitQuestions.find((q) => q.id === questionId);
            if (match) return match;
        }
        if (typeof EMBEDDED_CURRICULUM !== 'undefined' && Array.isArray(EMBEDDED_CURRICULUM)) {
            return EMBEDDED_CURRICULUM.find((q) => q.id === questionId);
        }
        return null;
    }

    function getFrqConfig(question) {
        if (!question) return null;
        return question.frqConfig || question.frq || null;
    }

    function formatFeedback(feedback) {
        if (!feedback) return '';
        const parts = [];

        if (feedback.score !== undefined && feedback.score !== null) {
            parts.push(`<div class="frq-feedback-score">Overall Score: <strong>${escapeHtml(feedback.score)}</strong> / 5</div>`);
        }

        if (feedback.summary) {
            parts.push(`
                <section class="frq-feedback-section">
                    <h4>Summary</h4>
                    <p>${escapeHtml(feedback.summary)}</p>
                </section>
            `);
        }

        if (Array.isArray(feedback.strengths) && feedback.strengths.length > 0) {
            const list = feedback.strengths.map(item => `<li>${escapeHtml(item)}</li>`).join('');
            parts.push(`
                <section class="frq-feedback-section">
                    <h4>Strengths</h4>
                    <ul>${list}</ul>
                </section>
            `);
        }

        if (Array.isArray(feedback.areasForImprovement) && feedback.areasForImprovement.length > 0) {
            const list = feedback.areasForImprovement.map(item => `<li>${escapeHtml(item)}</li>`).join('');
            parts.push(`
                <section class="frq-feedback-section">
                    <h4>Areas for Improvement</h4>
                    <ul>${list}</ul>
                </section>
            `);
        }

        if (Array.isArray(feedback.rubricAlignment) && feedback.rubricAlignment.length > 0) {
            const items = feedback.rubricAlignment.map((item) => {
                if (!item) return '';
                return `
                    <li>
                        <strong>${escapeHtml(item.criterion || 'Criterion')}:</strong>
                        <span class="frq-rubric-status ${escapeHtml(item.status || '').replace(/\s+/g, '-').toLowerCase()}">
                            ${escapeHtml(item.status || 'status unknown')}
                        </span>
                        ${item.notes ? `<div class="frq-rubric-notes">${escapeHtml(item.notes)}</div>` : ''}
                    </li>
                `;
            }).join('');

            parts.push(`
                <section class="frq-feedback-section">
                    <h4>Rubric Alignment</h4>
                    <ul class="frq-rubric-alignment">${items}</ul>
                </section>
            `);
        }

        return parts.join('');
    }

    function setStatus(questionId, message, type = 'info') {
        const statusEl = document.getElementById(`frq-feedback-status-${questionId}`);
        if (!statusEl) return;
        statusEl.textContent = message;
        statusEl.dataset.status = type;
    }

    function setLoading(questionId, isLoading) {
        const button = document.querySelector(`button[data-frq-feedback="${questionId}"]`);
        if (button) {
            button.disabled = isLoading;
            button.dataset.loading = isLoading ? 'true' : 'false';
        }
    }

    async function requestFeedback(questionId) {
        const question = findQuestion(questionId);
        if (!question) {
            setStatus(questionId, 'Unable to locate question details.', 'error');
            return;
        }

        const textarea = document.getElementById(`frq-${questionId}`);
        if (!textarea) {
            setStatus(questionId, 'Enter a response before requesting feedback.', 'error');
            return;
        }

        const responseText = textarea.value.trim();
        if (!responseText) {
            setStatus(questionId, 'Enter a response before requesting feedback.', 'error');
            textarea.focus();
            return;
        }

        if (!window.USE_RAILWAY || !window.RAILWAY_SERVER_URL) {
            setStatus(questionId, 'AI feedback requires the Railway proxy to be enabled.', 'error');
            return;
        }

        const frqConfig = getFrqConfig(question);
        const statusTarget = document.getElementById(`frq-feedback-result-${questionId}`);
        if (statusTarget) {
            statusTarget.style.display = 'none';
            statusTarget.innerHTML = '';
        }

        setStatus(questionId, 'Requesting AI feedback...', 'loading');
        setLoading(questionId, true);

        try {
            const consentGranted = await ensureConsent();
            if (!consentGranted) {
                setStatus(questionId, 'Consent is required to request AI feedback.', 'error');
                setLoading(questionId, false);
                return;
            }

            const payload = {
                questionId,
                prompt: question.prompt,
                studentResponse: responseText,
                exemplarResponse: frqConfig?.exemplar || '',
                rubric: frqConfig?.rubric || null,
                username: window.currentUsername || null
            };

            const response = await fetch(`${window.RAILWAY_SERVER_URL}/api/grade-frq`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data?.error || 'Failed to fetch feedback.');
            }

            feedbackCache.set(questionId, data.feedback);
            if (statusTarget) {
                statusTarget.style.display = 'block';
                statusTarget.innerHTML = formatFeedback(data.feedback);
            }

            setStatus(questionId, 'Feedback updated just now.', 'success');
        } catch (error) {
            console.error('FRQ feedback error:', error);
            setStatus(questionId, error.message || 'Unable to retrieve feedback.', 'error');
        } finally {
            setLoading(questionId, false);
        }
    }

    function restoreCachedFeedback(questionId) {
        const cached = feedbackCache.get(questionId);
        if (!cached) return;
        const container = document.getElementById(`frq-feedback-result-${questionId}`);
        if (container) {
            container.style.display = 'block';
            container.innerHTML = formatFeedback(cached);
        }
    }

    window.renderFRQQuestion = function (question, context = {}) {
        const savedAnswer = context.savedAnswer;
        const isDisabled = context.isDisabled;
        const responseValue = savedAnswer?.value || savedAnswer || '';
        const frqConfig = getFrqConfig(question);
        const hasRailway = Boolean(window.USE_RAILWAY);
        const hintText = frqConfig
            ? (hasRailway
                ? 'Uses exemplar & rubric embedded in this question.'
                : 'Enable the Railway proxy to activate AI feedback.')
            : 'Add an exemplar to enable richer feedback.';
        const hintClass = frqConfig
            ? `frq-exemplar-hint${hasRailway ? '' : ' muted'}`
            : 'frq-exemplar-hint muted';
        const hintState = frqConfig ? 'has' : 'missing';

        return `
            <div class="answer-section frq-answer-wrapper" data-question-id="${escapeHtml(question.id)}">
                <textarea
                    id="frq-${escapeHtml(question.id)}"
                    class="frq-textarea"
                    placeholder="Enter your complete response here..."
                    ${isDisabled ? 'disabled' : ''}>${escapeHtml(responseValue)}</textarea>
                <div class="frq-toolbar">
                    <button
                        type="button"
                        class="frq-feedback-button"
                        data-frq-feedback="${escapeHtml(question.id)}"
                    >🤖 Get AI Feedback</button>
                    <span class="${hintClass}" data-frq-exemplar-hint="${hintState}">${escapeHtml(hintText)}</span>
                </div>
                <div class="frq-feedback-status" id="frq-feedback-status-${escapeHtml(question.id)}" aria-live="polite"></div>
                <div class="frq-feedback-result" id="frq-feedback-result-${escapeHtml(question.id)}" style="display: none;"></div>
                ${renderRubricHtml(frqConfig, question.id)}
                ${frqConfig?.exemplar ? `
                    <details class="frq-exemplar-panel">
                        <summary>📝 View Exemplar Response</summary>
                        <pre>${escapeHtml(frqConfig.exemplar)}</pre>
                    </details>
                ` : ''}
            </div>
        `;
    };

    document.addEventListener('click', (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;

        if (target.dataset && target.dataset.frqFeedback) {
            const questionId = target.dataset.frqFeedback;
            requestFeedback(questionId);
        }
    });

    window.addEventListener('turboModeChanged', () => {
        document.querySelectorAll('.frq-exemplar-hint[data-frq-exemplar-hint="has"]').forEach((element) => {
            if (window.USE_RAILWAY) {
                element.classList.remove('muted');
                element.textContent = 'Uses exemplar & rubric embedded in this question.';
            } else {
                element.classList.add('muted');
                element.textContent = 'Enable the Railway proxy to activate AI feedback.';
            }
        });
    });

    window.addEventListener('load', () => {
        document.querySelectorAll('[data-question-id]').forEach((element) => {
            const questionId = element.getAttribute('data-question-id');
            if (questionId) {
                restoreCachedFeedback(questionId);
            }
        });
    });
})();
