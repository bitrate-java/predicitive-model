/* ==========================================================================
   PV Predictive Maintenance SCADA Console - Interactive Script
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize Lucide Icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }

    // 1.5 Initialize Dexie.js Database & History Console
    let db = null;
    const dbStatusBadge = document.getElementById('db-status-badge');
    const dbStatusDot = document.getElementById('db-status-dot');
    const dbStatusTextVal = document.getElementById('db-status-text-val');
    const dbHistoryTbody = document.getElementById('db-history-tbody');
    const btnLoadDb = document.getElementById('btn-load-db');
    const btnClearDb = document.getElementById('btn-clear-db');
    let selectedDbRowId = null;

    if (typeof Dexie !== 'undefined') {
        db = new Dexie('PV_Predict_DB');
        db.version(2).stores({
            telemetry_runs: '++id, timestamp, temp, volt, curr, irrad, health, failure, status, source'
        });

        db.open().then(() => {
            console.log("Dexie Database initialized successfully.");
            if (dbStatusBadge && dbStatusTextVal) {
                dbStatusBadge.classList.add('connected');
                dbStatusTextVal.textContent = "DB CONNECTED";
            }
            appendLog("IndexedDB connected: PV_Predict_DB store active.", "success");
            loadDbHistory();
        }).catch(err => {
            console.error("Dexie DB initialization failed:", err);
            appendLog("Database error: could not connect locally.", "danger");
        });
    } else {
        console.warn("Dexie is not defined. DB functionality disabled.");
        appendLog("Database error: Dexie.js library not loaded.", "danger");
    }

    function loadDbHistory() {
        if (!db || !dbHistoryTbody) return;

        db.telemetry_runs.orderBy('id').reverse().limit(50).toArray().then(records => {
            dbHistoryTbody.innerHTML = '';
            
            if (records.length === 0) {
                dbHistoryTbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 12px; color: var(--color-text-secondary); border: none;">No historical records saved yet.</td></tr>`;
                if (btnLoadDb) btnLoadDb.disabled = true;
                return;
            }

            records.forEach(rec => {
                const tr = document.createElement('tr');
                tr.setAttribute('data-id', rec.id);
                
                const date = new Date(rec.timestamp);
                const timeStr = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
                
                const voltVal = typeof rec.volt !== 'undefined' ? rec.volt : 38.0;
                const irradVal = typeof rec.irrad !== 'undefined' ? rec.irrad : 759.0;

                tr.innerHTML = `
                    <td style="padding: 6px 8px;">${timeStr}</td>
                    <td style="padding: 6px 8px;">${rec.temp.toFixed(1)}°C</td>
                    <td style="padding: 6px 8px;">${voltVal.toFixed(1)}V</td>
                    <td style="padding: 6px 8px;">${rec.curr.toFixed(1)}A</td>
                    <td style="padding: 6px 8px;">${irradVal.toFixed(0)}W/m²</td>
                    <td style="padding: 6px 8px;" class="${rec.health > 80 ? 'text-emerald' : rec.health > 50 ? 'text-warning' : 'text-danger'}">${rec.health}%</td>
                `;

                tr.addEventListener('click', () => {
                    document.querySelectorAll('#db-history-table tr').forEach(r => r.classList.remove('selected'));
                    tr.classList.add('selected');
                    selectedDbRowId = rec.id;
                    if (btnLoadDb) btnLoadDb.disabled = false;
                });

                dbHistoryTbody.appendChild(tr);
            });
        });
    }

    function saveTelemetryToDB(temp, volt, curr, irrad, health, failure, status, source = 'manual') {
        if (!db) return;

        db.telemetry_runs.add({
            timestamp: Date.now(),
            temp: temp,
            volt: volt,
            curr: curr,
            irrad: irrad,
            health: health,
            failure: failure,
            status: status,
            source: source
        }).then(() => {
            // Keep DB small (max 200 records) to stay space efficient
            db.telemetry_runs.count().then(count => {
                if (count > 200) {
                    db.telemetry_runs.orderBy('id').limit(count - 200).keys().then(keys => {
                        db.telemetry_runs.bulkDelete(keys).then(() => {
                            loadDbHistory();
                        });
                    });
                } else {
                    loadDbHistory();
                }
            });
        }).catch(err => {
            console.error("Error saving telemetry to DB:", err);
        });
    }

    if (btnLoadDb) {
        btnLoadDb.addEventListener('click', () => {
            if (!db || !selectedDbRowId) return;

            db.telemetry_runs.get(selectedDbRowId).then(rec => {
                if (rec) {
                    sliderTemp.value = rec.temp;
                    sliderVolt.value = typeof rec.volt !== 'undefined' ? rec.volt : 38.0;
                    sliderCurr.value = rec.curr;
                    const irrad = typeof rec.irrad !== 'undefined' ? rec.irrad : calculateIrradiance(rec.temp, rec.curr, sliderVolt.value);
                    if (sliderIrrad) sliderIrrad.value = Math.round(irrad);
                    updateDashboardUI(rec.temp, sliderVolt.value, rec.curr, irrad, true);
                    appendLog(`Restored telemetry from DB run: T=${rec.temp.toFixed(1)}°C, V=${sliderVolt.value}V, C=${rec.curr.toFixed(1)}A, G=${irrad.toFixed(0)}W/m²`, "success");
                }
            });
        });
    }

    if (btnClearDb) {
        btnClearDb.addEventListener('click', () => {
            if (!db) return;
            if (confirm("Are you sure you want to clear all browser-saved runs?")) {
                db.telemetry_runs.clear().then(() => {
                    loadDbHistory();
                    selectedDbRowId = null;
                    if (btnLoadDb) btnLoadDb.disabled = true;
                    appendLog("IndexedDB telemetry cache cleared.", "warning");
                });
            }
        });
    }

    // 2. Navigation Highlights and Sticky State
    const navbar = document.querySelector('.navbar-container');
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('section');

    window.addEventListener('scroll', () => {
        // Sticky Header State
        if (window.scrollY > 50) {
            navbar.style.background = 'rgba(7, 11, 25, 0.9)';
            navbar.style.padding = '4px 0';
        } else {
            navbar.style.background = 'rgba(7, 11, 25, 0.7)';
            navbar.style.padding = '0';
        }

        // Active Link Highlighting
        let currentSectionId = '';
        sections.forEach(section => {
            const sectionTop = section.offsetTop - 120;
            const sectionHeight = section.clientHeight;
            if (window.scrollY >= sectionTop && window.scrollY < sectionTop + sectionHeight) {
                currentSectionId = section.getAttribute('id');
            }
        });

        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${currentSectionId}`) {
                link.classList.add('active');
            }
        });
    });

    // Mobile Navbar Toggle
    const mobileToggle = document.querySelector('.mobile-nav-toggle');
    const navMenu = document.querySelector('.nav-links');

    if (mobileToggle && navMenu) {
        mobileToggle.addEventListener('click', () => {
            navMenu.classList.toggle('active');
            const icon = mobileToggle.querySelector('i');
            if (navMenu.classList.contains('active')) {
                icon.setAttribute('data-lucide', 'x');
            } else {
                icon.setAttribute('data-lucide', 'menu');
            }
            lucide.createIcons();
        });

        // Close mobile nav on link click
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                navMenu.classList.remove('active');
                mobileToggle.querySelector('i').setAttribute('data-lucide', 'menu');
                lucide.createIcons();
            });
        });
    }

    // 3. Scroll Reveal Effect (Intersection Observer)
    const revealElements = document.querySelectorAll('.challenge-card, .timeline-node, .team-card, .tech-item-card, .results-info, .results-chart-box, .contact-box-wrapper');
    
    // Add reveal class dynamically to elements
    revealElements.forEach(el => el.classList.add('reveal'));

    const revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.15 });

    revealElements.forEach(el => revealObserver.observe(el));


    // 5. Solution Architecture Interactive Step Diagram
    const architectureNodes = document.querySelectorAll('.diagram-node');
    const archDetailTitle = document.getElementById('architecture-detail-title');
    const archDetailDesc = document.getElementById('architecture-detail-desc');
    const nodeDetails = {
        1: {
            title: "PV Solar Panel Array (Physical Layer)",
            desc: "The physical solar field, including utility-scale PV panel strings, solar trackers, and electrical junction boxes. Stressed continuously by outdoor environments, soil cover, UV radiation, and wind loads."
        },
        2: {
            title: "Virtual Sensors (Data Acquisition Layer)",
            desc: "Direct solar module temperature sensors and output current/voltage lines mapping physical panel behaviors in real-time."
        },
        3: {
            title: "MATLAB & Simulink Monitoring (Signal Processing Layer)",
            desc: "Runs continuous mathematical analysis, calculating solar irradiance models, thermal coefficients, and current-voltage deviations to filter out temporary cloud shade fluctuations."
        },
        4: {
            title: "Machine Learning Model (Intelligence Layer)",
            desc: "Trained Random Forest (100 trees, OOB 98.96%) and Decision Tree classifiers processing 15 electrical/thermal engineered features (Current_Drop_Pct, VOC_Ratio, Temp_Zscore). Trained on 342,912 telemetry records across years of panel operations."
        },
        5: {
            title: "Failure Prediction Engine (Analysis Layer)",
            desc: "Applies Kalman Filtering on Clean_VOC_KF, Dusty_VOC_KF, Clean Current_KF, and Dusty Current_KF electrical outputs. Extrapolates capacity trends using exponential degradation equations to estimate standard warranty Remaining Useful Life (RUL) in Years."
        },
        6: {
            title: "Dashboard & Alerts (SCADA UI Layer)",
            desc: "The digital twin command center. Emits real-time visual warnings, logs anomaly triggers, displays panel trends, and flags PV array safety status changes instantly."
        },
        7: {
            title: "Actionable Maintenance Recommendations (Operational Layer)",
            desc: "The pipeline's final output. Replaces calendar scheduling with smart diagnostic instructions, indicating exact field actions such as 'panel cleaning' or 'check bypass diodes'."
        }
    };

    architectureNodes.forEach(node => {
        node.addEventListener('click', () => {
            architectureNodes.forEach(n => n.classList.remove('active'));
            node.classList.add('active');
            
            const nodeId = node.getAttribute('data-node');
            const data = nodeDetails[nodeId];
            
            if (data && archDetailTitle && archDetailDesc) {
                // Smoothly swap content
                const panel = document.getElementById('architecture-detail-box');
                panel.style.opacity = '0.3';
                panel.style.transform = 'translateY(5px)';
                
                setTimeout(() => {
                    archDetailTitle.textContent = `${data.title} - Active`;
                    archDetailDesc.textContent = data.desc;
                    panel.style.opacity = '1';
                    panel.style.transform = 'translateY(0)';
                }, 200);
            }
        });
    });

    // 6. SCADA Interactive Dashboard Logic
    
    // Sliders
    const sliderTemp = document.getElementById('slider-temp');
    const sliderVolt = document.getElementById('slider-volt');
    const sliderCurr = document.getElementById('slider-curr');
    const sliderIrrad = document.getElementById('slider-irrad');
    const valTemp = document.getElementById('val-temp');
    const valVolt = document.getElementById('val-volt');
    const valCurr = document.getElementById('val-curr');
    const valIrrad = document.getElementById('val-irrad');
    
    // Gauges
    const gaugeTempNum = document.getElementById('gauge-temp-num');
    const gaugeVoltNum = document.getElementById('gauge-volt-num');
    const gaugeCurrNum = document.getElementById('gauge-curr-num');
    const gaugeIrradNum = document.getElementById('gauge-irrad-num');
    
    const gaugeTempCircle = document.getElementById('gauge-temp-circle');
    const gaugeVoltCircle = document.getElementById('gauge-volt-circle');
    const gaugeCurrCircle = document.getElementById('gauge-curr-circle');
    const gaugeIrradCircle = document.getElementById('gauge-irrad-circle');

    // Mathematical formula helper for Solar Irradiance
    function calculateIrradiance(temp, curr, volt) {
        const P_rated = 400;
        const beta = 0.004;
        const thermalFactor = 1 - beta * (temp - 25);
        const G = 1000 * ((volt * curr) / P_rated) * thermalFactor;
        return Math.max(0, G); // Irradiance cannot be negative
    }

    // KPI Displays
    const kpiHealth = document.getElementById('kpi-health');
    const kpiProb = document.getElementById('kpi-prob');
    const kpiRul = document.getElementById('kpi-rul');
    const activeModeDisplay = document.getElementById('active-mode-display');
    
    // AI Status Indicator Elements
    const aiIndicator = document.getElementById('ai-status-indicator');
    const aiTitle = document.getElementById('ai-status-title');
    const aiIcon = document.getElementById('ai-status-icon');
    
    // Recommendations & Logs
    const recList = document.getElementById('recommendation-list');
    const logBox = document.getElementById('dashboard-logs');
    const btnClearLogs = document.getElementById('clear-logs');
    const btnResetSensors = document.getElementById('btn-reset-sensors');

    // State Variables
    let currentMode = 'health'; // 'health', 'failure', 'rul', 'downtime'
    let liveTimer = null;
    let logIndex = 1;

    // SVG Gauge calculation helpers
    // Stroke dasharray is 251.2
    function updateGaugeSVG(circleElement, value, min, max) {
        if (!circleElement) return;
        let percent = (value - min) / (max - min);
        percent = Math.min(Math.max(percent, 0), 1); // Clamp
        const circumference = 251.2;
        const offset = circumference - (percent * circumference);
        circleElement.style.strokeDashoffset = offset;
    }

    // Logger
    function appendLog(message, type = '') {
        if (!logBox) return;
        const p = document.createElement('p');
        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
        p.textContent = `[${timeStr}] ${message}`;
        if (type) {
            p.className = `text-${type}`;
        }
        logBox.appendChild(p);
        logBox.scrollTop = logBox.scrollHeight;
    }

    if (btnClearLogs) {
        btnClearLogs.addEventListener('click', () => {
            if (logBox) logBox.innerHTML = '';
        });
    }

    // AI Predictive Threshold Evaluator
    function evaluateTelemetry(temp, volt, curr, irrad) {
        let status = 'healthy'; // 'healthy', 'warning', 'critical'
        let healthVal = 98;
        let failureProb = 2;
        let rulYears = 25.0;
        let downtimeSaved = 12.0;
        let diagnostics = [];

        // Telemetry anomalies above thresholds
        const tempDelta = Math.max(0, temp - 80);
        const currDelta = curr < 5.0 ? (5.0 - curr) : Math.max(0, curr - 15.0);
        const voltDelta = volt < 36.0 ? (36.0 - volt) : Math.max(0, volt - 40.0);

        // Accelerated degradation rate calculation (base is 0.65% per year)
        let degradationRate = 0.65 + (tempDelta * 0.05) + (currDelta * 0.15) + (voltDelta * 0.1);
        degradationRate = Math.min(Math.max(degradationRate, 0.5), 10.0);

        // Panel Health reduction calculation
        healthVal -= (tempDelta * 0.8) + (currDelta * 3) + (voltDelta * 1.5);
        healthVal = Math.round(Math.max(Math.min(healthVal, 100), 5));
        failureProb = Math.round(100 - healthVal);

        // RUL calculation in Years:
        rulYears = (healthVal / 100) * 25;
        rulYears = Math.max(0.0, Math.round(rulYears * 10) / 10);

        // Power Outage Downtime Saved (in Days)
        downtimeSaved = 12.0 + (100 - healthVal) * 0.75;
        downtimeSaved = Math.max(12.0, Math.round(downtimeSaved * 10) / 10);

        if (temp > 110 || curr > 18.0 || curr < 3.0 || volt > 43.0 || volt < 32.0) {
            status = 'critical';
        } else if (temp > 80 || curr > 15.0 || curr < 5.0 || volt > 40.0 || volt < 36.0) {
            status = 'warning';
        }

        // Context-aware diagnostics for operational solar panels
        if (status === 'healthy') {
            diagnostics.push({
                icon: 'check-circle-2',
                type: 'success',
                title: 'System Balanced',
                desc: 'All panels operating within peak capacity. Normal voltage, current, and thermal limits.'
            });
        }

        if (temp > 80) {
            diagnostics.push({
                icon: 'thermometer',
                type: temp > 110 ? 'danger' : 'warning',
                title: temp > 110 ? 'Severe Hotspot / Diode Failure' : 'Elevated Thermal Signature',
                desc: temp > 110 ? 'Localized cell temperature exceeding safety limits. High risk of backsheet burn. Shunt string output!' : 'Minor thermal anomaly in module junction box. Monitor shading.'
            });
        }

        if (volt > 40.0 || volt < 36.0) {
            diagnostics.push({
                icon: 'activity',
                type: (volt > 43.0 || volt < 32.0) ? 'danger' : 'warning',
                title: (volt > 43.0 || volt < 32.0) ? 'Critical Voltage Anomaly' : 'Voltage Output Fluctuation',
                desc: volt < 36.0 ? 'Under-voltage detected. Possible bypass diode conduction or string wiring resistance.' : 'Over-voltage detected. Open circuit danger or charge controller fault.'
            });
        }

        if (curr > 15.0 || curr < 5.0) {
            if (curr > 18.0) {
                diagnostics.push({
                    icon: 'zap',
                    type: 'danger',
                    title: 'String Overcurrent / Short Circuit',
                    desc: 'Current output exceeds rating. Inspect combiner box for short circuits.'
                });
            } else if (curr < 3.0) {
                diagnostics.push({
                    icon: 'zap-off',
                    type: 'danger',
                    title: 'Critical Output Drop / Shading',
                    desc: 'Current output below 33% rating. Heavy soil cover, physical blockage, or junction box wire failure.'
                });
            } else if (curr > 15.0) {
                diagnostics.push({
                    icon: 'zap',
                    type: 'warning',
                    title: 'Module Output Overload',
                    desc: 'Elevated current due to excessive irradiance. No immediate service required.'
                });
            } else {
                diagnostics.push({
                    icon: 'zap',
                    type: 'warning',
                    title: 'Soiling / Grid Shading Warning',
                    desc: 'Output current degraded. Panel requires cleaning or check for adjacent tree shading.'
                });
            }
        }

        if (irrad < 300) {
            diagnostics.push({
                icon: 'sun',
                type: 'warning',
                title: 'Low Solar Irradiance',
                desc: `Irradiance is weak (${Math.round(irrad)} W/m²). Reduced PV power output expected due to cloud cover or late hours.`
            });
        }

        return { status, healthVal, failureProb, rulYears, downtimeSaved, diagnostics };
    }

    // Update Dashboard UI Elements
    let lastStatus = 'healthy';
    function updateDashboardUI(temp, volt, curr, irrad, animateLogs = true) {
        // Sliders Text
        if (valTemp) valTemp.textContent = temp.toFixed(1);
        if (valVolt) valVolt.textContent = volt.toFixed(1);
        if (valCurr) valCurr.textContent = curr.toFixed(1);
        if (valIrrad) valIrrad.textContent = irrad.toFixed(0);

        // Gauges Values
        if (gaugeTempNum) gaugeTempNum.textContent = Math.round(temp);
        if (gaugeVoltNum) gaugeVoltNum.textContent = volt.toFixed(1);
        if (gaugeCurrNum) gaugeCurrNum.textContent = curr.toFixed(1);
        if (gaugeIrradNum) gaugeIrradNum.textContent = Math.round(irrad);

        // Gauges Circles SVG Offset
        updateGaugeSVG(gaugeTempCircle, temp, 20, 130);
        updateGaugeSVG(gaugeVoltCircle, volt, 30, 45);
        updateGaugeSVG(gaugeCurrCircle, curr, 1, 25);
        updateGaugeSVG(gaugeIrradCircle, irrad, 0, 1200);

        // Evaluate state
        const metrics = evaluateTelemetry(temp, volt, curr, irrad);

        // Update KPI values
        if (kpiHealth) kpiHealth.textContent = `${metrics.healthVal}%`;
        if (kpiProb) kpiProb.textContent = `${metrics.failureProb}%`;
        
        if (kpiRul) {
            kpiRul.textContent = metrics.healthVal <= 10 ? 'DECOMMISSIONED' : `${metrics.rulYears.toFixed(1)} Yrs`;
        }
        
        const kpiDowntime = document.getElementById('kpi-downtime');
        if (kpiDowntime) {
            kpiDowntime.textContent = `${metrics.downtimeSaved.toFixed(1)} Days`;
        }

        // Style KPIs based on health
        if (kpiHealth) {
            kpiHealth.className = 'kpi-num font-display ' + (metrics.healthVal > 80 ? 'text-emerald' : metrics.healthVal > 50 ? 'text-warning' : 'text-danger');
        }

        // Dynamic State Transitions
        if (aiIndicator && aiTitle && aiIcon) {
            aiIndicator.className = 'ai-status-card ' + metrics.status;
            
            if (metrics.status === 'healthy') {
                aiTitle.textContent = 'NORMAL';
                aiIcon.setAttribute('data-lucide', 'shield-check');
            } else if (metrics.status === 'warning') {
                aiTitle.textContent = 'WARNING: ANOMALY';
                aiIcon.setAttribute('data-lucide', 'alert-triangle');
            } else {
                aiTitle.textContent = 'CRITICAL FAULT';
                aiIcon.setAttribute('data-lucide', 'flame');
            }
            lucide.createIcons();
        }

        // Recommendations List Update
        if (recList) {
            recList.innerHTML = '';
            metrics.diagnostics.forEach(rec => {
                const div = document.createElement('div');
                div.className = `rec-item text-${rec.type}`;
                div.innerHTML = `
                    <i data-lucide="${rec.icon}"></i>
                    <div>
                        <strong>${rec.title}</strong>
                        <p>${rec.desc}</p>
                    </div>
                `;
                recList.appendChild(div);
            });
            lucide.createIcons();
        }

        // Log events during state shifts
        if (animateLogs && metrics.status !== lastStatus) {
            if (metrics.status === 'warning') {
                appendLog("AI WARNING: Sensor threshold anomaly (hotspot, voltage, or soiling) detected.", "warning");
            } else if (metrics.status === 'critical') {
                appendLog("AI CRITICAL ALERT: Severe operational anomaly! Inspection highly recommended.", "danger");
            } else {
                appendLog("Telemetry stabilized: Solar PV panel output normal.", "success");
            }
            lastStatus = metrics.status;
        }
    }

    // Slider Listeners
    function attachSliderListeners() {
        [sliderTemp, sliderVolt, sliderCurr, sliderIrrad].forEach(slider => {
            if (!slider) return;
            slider.addEventListener('input', () => {
                const temp = parseFloat(sliderTemp.value);
                const volt = parseFloat(sliderVolt.value);
                const curr = parseFloat(sliderCurr.value);
                const irrad = parseFloat(sliderIrrad ? sliderIrrad.value : 800);
                
                updateDashboardUI(temp, volt, curr, irrad, true);
                
                // Add telemetry log on drag
                if (Math.random() < 0.08) { // rate limit logs slightly during drag
                    appendLog(`Manual Telemetry Override active: T=${temp.toFixed(1)}°C, V=${volt.toFixed(1)}V, C=${curr.toFixed(1)}A, G=${irrad.toFixed(0)}W/m²`);
                }
            });

            // Save telemetry snapshot to database when user stops dragging
            slider.addEventListener('change', () => {
                const temp = parseFloat(sliderTemp.value);
                const volt = parseFloat(sliderVolt.value);
                const curr = parseFloat(sliderCurr.value);
                const irrad = parseFloat(sliderIrrad ? sliderIrrad.value : 800);
                const metrics = evaluateTelemetry(temp, volt, curr, irrad);
                saveTelemetryToDB(temp, volt, curr, irrad, metrics.healthVal, metrics.failureProb, metrics.status, 'manual');
            });
        });
    }
    attachSliderListeners();

    // Reset Buttons
    if (btnResetSensors) {
        btnResetSensors.addEventListener('click', () => {
            if (sliderTemp) sliderTemp.value = 45;
            if (sliderVolt) sliderVolt.value = 38.0;
            if (sliderCurr) sliderCurr.value = 8.5;
            if (sliderIrrad) sliderIrrad.value = 800;
            
            updateDashboardUI(45, 38.0, 8.5, 800, true);
            saveTelemetryToDB(45, 38.0, 8.5, 800, 98, 2, 'healthy', 'manual');
            appendLog("SCADA Alert Overrides fully cleared. Default telemetry streams loaded.", "success");
        });
    }

    // ==========================================================================
    // 7. CHART.JS CONFIGURATION - Dual Mode SCADA Trends
    // ==========================================================================
    const scadaCtx = document.getElementById('scadaLiveChart');
    let scadaChartInstance = null;

    // Simulation Dataset definitions
    let chartTimeLabels = Array.from({length: 12}, (_, i) => `T-${11 - i}s`);
    
    // Telemetry trend variables
    let trendDataTemp = Array.from({length: 12}, () => 40 + Math.random() * 8);
    let trendDataVolt = Array.from({length: 12}, () => 37 + Math.random() * 2);
    let trendDataCurr = Array.from({length: 12}, () => 7 + Math.random() * 2);
    let trendDataIrrad = Array.from({length: 12}, () => 800 + Math.random() * 50);
    let trendDataHealth = Array.from({length: 12}, () => 95 + Math.random() * 3);

    function initSCADAChart() {
        if (!scadaCtx) return;

        // Custom neon gradient creation
        const gradientCyan = scadaCtx.getContext('2d').createLinearGradient(0, 0, 0, 300);
        gradientCyan.addColorStop(0, 'rgba(56, 189, 248, 0.35)');
        gradientCyan.addColorStop(1, 'rgba(56, 189, 248, 0.00)');

        const gradientEmerald = scadaCtx.getContext('2d').createLinearGradient(0, 0, 0, 300);
        gradientEmerald.addColorStop(0, 'rgba(16, 185, 129, 0.35)');
        gradientEmerald.addColorStop(1, 'rgba(16, 185, 129, 0.00)');

        scadaChartInstance = new Chart(scadaCtx, {
            type: 'line',
            data: {
                labels: chartTimeLabels,
                datasets: [
                    {
                        label: 'Module Temperature (°C)',
                        data: trendDataTemp,
                        borderColor: '#38BDF8',
                        borderWidth: 2,
                        backgroundColor: gradientCyan,
                        fill: true,
                        tension: 0.35,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Panel Voltage (V)',
                        data: trendDataVolt,
                        borderColor: '#F59E0B',
                        borderWidth: 2,
                        fill: false,
                        tension: 0.3,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Output Current (A)',
                        data: trendDataCurr,
                        borderColor: '#3B82F6',
                        borderWidth: 2,
                        fill: false,
                        tension: 0.3,
                        yAxisID: 'y1'
                    },
                    {
                        label: 'Solar Irradiance (W/m²)',
                        data: trendDataIrrad,
                        borderColor: '#10B981',
                        borderWidth: 2,
                        backgroundColor: gradientEmerald,
                        fill: true,
                        tension: 0.35,
                        yAxisID: 'y2'
                    },
                    {
                        label: 'Panel Health Score (%)',
                        data: trendDataHealth,
                        borderColor: '#059669',
                        borderWidth: 3,
                        fill: false,
                        tension: 0.3,
                        yAxisID: 'y'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: '#94A3B8',
                            font: { family: 'Inter', size: 11 }
                        }
                    },
                    tooltip: {
                        backgroundColor: '#0F172A',
                        titleFont: { family: 'Orbitron' },
                        bodyFont: { family: 'Inter' }
                    }
                },
                scales: {
                    x: {
                        grid: { color: 'rgba(255, 255, 255, 0.04)' },
                        ticks: { color: '#94A3B8' }
                    },
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        min: 0,
                        max: 140,
                        grid: { color: 'rgba(255, 255, 255, 0.04)' },
                        ticks: { color: '#94A3B8' },
                        title: { display: true, text: 'Temp (°C) / Volt (V) / Health (%)', color: '#94A3B8' }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        min: 0,
                        max: 26,
                        grid: { drawOnChartArea: false },
                        ticks: { color: '#94A3B8' },
                        title: { display: true, text: 'Output Current (A)', color: '#94A3B8' }
                    },
                    y2: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        min: 0,
                        max: 1200,
                        grid: { drawOnChartArea: false },
                        ticks: { color: '#94A3B8' },
                        title: { display: true, text: 'Solar Irradiance (W/m²)', color: '#94A3B8' }
                    }
                }
            }
        });
    }

    // Simulate Active Live Updates (when not running static simulations)
    let updateIntervalTimer = null;
    function startLiveTelemetryTrend() {
        if (updateIntervalTimer) clearInterval(updateIntervalTimer);

        updateIntervalTimer = setInterval(() => {
            if (currentMode !== 'health') return;

            // Shift label
            chartTimeLabels.push('T-0s');
            chartTimeLabels.shift();
            
            // Generate minor offsets from sliders (simulates fluctuation)
            const baseTemp = parseFloat(sliderTemp.value);
            const baseVolt = parseFloat(sliderVolt.value);
            const baseCurr = parseFloat(sliderCurr.value);
            const baseIrrad = parseFloat(sliderIrrad ? sliderIrrad.value : 800);

            const activeTemp = baseTemp + (Math.random() - 0.5) * 1.5;
            const activeVolt = Math.min(45, Math.max(30, baseVolt + (Math.random() - 0.5) * 0.4));
            const activeCurr = Math.max(1, baseCurr + (Math.random() - 0.5) * 0.3);
            const activeIrrad = Math.min(1200, Math.max(0, baseIrrad + (Math.random() - 0.5) * 15));
            
            // Re-evaluate health score
            const metrics = evaluateTelemetry(activeTemp, activeVolt, activeCurr, activeIrrad);

            // Push values
            trendDataTemp.push(activeTemp);
            trendDataVolt.push(activeVolt);
            trendDataCurr.push(activeCurr);
            trendDataIrrad.push(activeIrrad);
            trendDataHealth.push(metrics.healthVal);

            // Shift arrays
            trendDataTemp.shift();
            trendDataVolt.shift();
            trendDataCurr.shift();
            trendDataIrrad.shift();
            trendDataHealth.shift();

            // Refresh UI gauges with dynamic offset fluctuation
            updateDashboardUI(activeTemp, activeVolt, activeCurr, activeIrrad, false);

            // Update Chart
            if (scadaChartInstance && scadaChartInstance.config.type === 'line') {
                scadaChartInstance.update('none'); // silent update
            }
        }, 1200);
    }

    // Toggle live vs model visualization in the panel
    const btnToggleLive = document.getElementById('btn-toggle-telemetry');
    const btnToggleModel = document.getElementById('btn-toggle-model');

    if (btnToggleLive && btnToggleModel) {
        btnToggleLive.addEventListener('click', () => {
            btnToggleLive.classList.add('active');
            btnToggleModel.classList.remove('active');
            
            // Reload standard Live Telemetry Layout
            loadSimulationMode('health');
        });

        btnToggleModel.addEventListener('click', () => {
            btnToggleModel.classList.add('active');
            btnToggleLive.classList.remove('active');
            
            // Launch simulation curve
            loadSimulationMode('rul');
        });
    }

    // ==========================================================================
    // 8. MATLAB SIMULATIONS TRIGGERS & DECK CONTROLLER
    // ==========================================================================
    const simulationCards = document.querySelectorAll('.simulation-card');
    const runSimButtons = document.querySelectorAll('.btn-run-sim');

    function loadSimulationMode(mode) {
        currentMode = mode;

        // Visual State Synchronization (Cards indicators)
        simulationCards.forEach(card => {
            card.classList.remove('active');
            const badge = card.querySelector('.sim-badge');
            const button = card.querySelector('.btn-run-sim');
            
            if (card.getAttribute('data-sim') === mode) {
                card.classList.add('active');
                if (badge) {
                    badge.className = 'sim-badge cyan';
                    badge.textContent = 'ACTIVE';
                }
                if (button) {
                    button.innerHTML = `<i data-lucide="check" class="play-ic"></i> Loaded in Dashboard`;
                }
            } else {
                if (badge) {
                    badge.className = 'sim-badge';
                    badge.textContent = 'STANDBY';
                }
                if (button) {
                    button.innerHTML = `<i data-lucide="play" class="play-ic"></i> Run Simulation`;
                }
            }
        });
        lucide.createIcons();

        // 1. PV Module Health Monitoring Profile
        if (mode === 'health') {
            if (activeModeDisplay) {
                activeModeDisplay.innerHTML = `<i data-lucide="activity"></i> PV Module Health Monitoring`;
            }
            appendLog("Simulation profile loaded: [PV Module Health Monitoring]", "success");
            appendLog("Acquiring environmental sensor streams. Monitoring active panel output.");

            // Reset Sliders
            sliderTemp.value = 45;
            sliderVolt.value = 38.0;
            sliderCurr.value = 8.5;
            if (sliderIrrad) sliderIrrad.value = 1000;
            updateDashboardUI(45, 38.0, 8.5, 1000, true);

            // Configure standard Line Telemetry Chart
            if (scadaChartInstance) {
                scadaChartInstance.config.type = 'line';
                scadaChartInstance.config.data.labels = chartTimeLabels;
                scadaChartInstance.config.data.datasets = [
                    {
                        label: 'Module Temperature (°C)',
                        data: trendDataTemp,
                        borderColor: '#38BDF8',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.35,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Panel Voltage (V)',
                        data: trendDataVolt,
                        borderColor: '#F59E0B',
                        borderWidth: 2,
                        fill: false,
                        tension: 0.3,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Output Current (A)',
                        data: trendDataCurr,
                        borderColor: '#3B82F6',
                        borderWidth: 2,
                        fill: false,
                        tension: 0.3,
                        yAxisID: 'y1'
                    },
                    {
                        label: 'Solar Irradiance (W/m²)',
                        data: trendDataIrrad,
                        borderColor: '#10B981',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.35,
                        yAxisID: 'y2'
                    },
                    {
                        label: 'Panel Health Score (%)',
                        data: trendDataHealth,
                        borderColor: '#059669',
                        borderWidth: 3,
                        fill: false,
                        tension: 0.3,
                        yAxisID: 'y'
                    }
                ];
                scadaChartInstance.options.scales.y.max = 140;
                scadaChartInstance.options.scales.y.title.text = 'Temp (°C) / Volt (V) / Health (%)';
                scadaChartInstance.options.scales.y1.max = 26;
                scadaChartInstance.options.scales.y1.title.text = 'Output Current (A)';
                scadaChartInstance.options.scales.y1.display = true;
                scadaChartInstance.options.scales.y2.display = true;
                scadaChartInstance.update();
            }
            startLiveTelemetryTrend();
        }

        // 2. AI Failure Prediction Profile (Confusion Matrix / Classification)
        else if (mode === 'failure') {
            if (activeModeDisplay) {
                activeModeDisplay.innerHTML = `<i data-lucide="brain-circuit"></i> AI Failure Prediction`;
            }
            appendLog("Simulation profile loaded: [AI Degradation Prediction Random Forest]");
            appendLog("Computing Decision Tree branches. Out-of-bag error rate: 1.04% | OOB Score: 98.96%");
            
            // Set slider to border line warning threshold to show prediction engine active
            sliderTemp.value = 92;
            sliderVolt.value = 35.5;
            sliderCurr.value = 4.2;
            if (sliderIrrad) sliderIrrad.value = 900;
            updateDashboardUI(92, 35.5, 4.2, 900, true);

            // Re-render chart to show dynamic Predictive Classifier Confidence Plot
            if (scadaChartInstance) {
                scadaChartInstance.config.type = 'line';
                scadaChartInstance.config.data.labels = ['Tree 10', 'Tree 20', 'Tree 30', 'Tree 40', 'Tree 50', 'Tree 60', 'Tree 70', 'Tree 80', 'Tree 90', 'Tree 100'];
                
                scadaChartInstance.config.data.datasets = [
                    {
                        label: 'Random Forest Prediction Classifier Confidence (%)',
                        data: [88.5, 92.1, 95.3, 96.8, 97.5, 98.1, 98.6, 98.8, 98.9, 98.96],
                        borderColor: '#38BDF8',
                        borderWidth: 3,
                        backgroundColor: 'rgba(56, 189, 248, 0.1)',
                        fill: true,
                        tension: 0.2,
                        yAxisID: 'y'
                    },
                    {
                        label: 'F-1 Score Benchmark Threshold (%)',
                        data: [85, 85, 85, 85, 85, 85, 85, 85, 85, 85],
                        borderColor: '#EF4444',
                        borderWidth: 2,
                        borderDash: [6, 6],
                        fill: false,
                        tension: 0,
                        yAxisID: 'y'
                    }
                ];
                scadaChartInstance.options.scales.y.max = 100;
                scadaChartInstance.options.scales.y.title.text = 'Model Confidence Rating';
                scadaChartInstance.options.scales.y1.display = false; // Hide 2nd Y axis
                if (scadaChartInstance.options.scales.y2) scadaChartInstance.options.scales.y2.display = false; // Hide 3rd Y axis
                scadaChartInstance.update();
            }
        }

        // 3. RUL Forecasting Curve
        else if (mode === 'rul') {
            if (activeModeDisplay) {
                activeModeDisplay.innerHTML = `<i data-lucide="hourglass"></i> Remaining Useful Life (RUL)`;
            }
            appendLog("Simulation profile loaded: [RUL Degradation Forecast]", "warning");
            appendLog("Applying continuous physics-based model equations. Lifetime: 25 years.");

            sliderTemp.value = 112;
            sliderVolt.value = 32.0;
            sliderCurr.value = 2.5;
            if (sliderIrrad) sliderIrrad.value = 850;
            updateDashboardUI(112, 32.0, 2.5, 850, true);

            // Re-render chart to show RUL degradation curve
            if (scadaChartInstance) {
                scadaChartInstance.config.type = 'line';
                scadaChartInstance.config.data.labels = ['Year 0', 'Year 5', 'Year 10', 'Year 15', 'Year 20', 'Year 25', 'Forecast Y26', 'Forecast Y27', 'Forecast Y28', 'Forecast Y29'];
                
                scadaChartInstance.config.data.datasets = [
                    {
                        label: 'Solar Panel Capacity degradation (%)',
                        data: [100, 96.8, 93.5, 90.2, 87.0, 83.7, 80.5, 78.5, 76.5, 74.5],
                        borderColor: '#EF4444',
                        borderWidth: 3,
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        fill: true,
                        tension: 0.3,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Warranty Capacity Limit (80%)',
                        data: [80, 80, 80, 80, 80, 80, 80, 80, 80, 80],
                        borderColor: '#F59E0B',
                        borderWidth: 2,
                        borderDash: [4, 4],
                        fill: false,
                        tension: 0,
                        yAxisID: 'y'
                    }
                ];
                scadaChartInstance.options.scales.y.max = 100;
                scadaChartInstance.options.scales.y.title.text = 'Overall Capacity Index (%)';
                scadaChartInstance.options.scales.y1.display = false;
                if (scadaChartInstance.options.scales.y2) scadaChartInstance.options.scales.y2.display = false;
                scadaChartInstance.update();
            }
        }

        // 4. Downtime Savings Studies
        else if (mode === 'downtime') {
            if (activeModeDisplay) {
                activeModeDisplay.innerHTML = `<i data-lucide="bar-chart-3"></i> Outage Downtime Savings`;
            }
            appendLog("Simulation profile loaded: [Outage Downtime Mitigation Analysis]", "success");
            appendLog("Generating analytical matrix. Traditional manual inspections vs. AI predictive alerts.");

            sliderTemp.value = 45;
            sliderVolt.value = 38.0;
            sliderCurr.value = 8.5;
            if (sliderIrrad) sliderIrrad.value = 1000;
            updateDashboardUI(45, 38.0, 8.5, 1000, true);

            // Re-render chart to show Optimized downtime curves (bar chart)
            if (scadaChartInstance) {
                scadaChartInstance.config.type = 'bar';
                scadaChartInstance.config.data.labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                
                scadaChartInstance.config.data.datasets = [
                    {
                        label: 'Reactive Outage Losses (Days)',
                        data: [4.2, 2.8, 5.1, 2.1, 7.5, 4.8, 3.1, 10.2, 3.8, 6.2, 1.7, 8.1],
                        backgroundColor: 'rgba(239, 68, 68, 0.45)',
                        borderColor: '#EF4444',
                        borderWidth: 1.5,
                        yAxisID: 'y'
                    },
                    {
                        label: 'AI-Predictive Outage Losses (Days)',
                        data: [1.0, 0.6, 1.3, 0.3, 1.0, 1.6, 0.7, 2.0, 1.0, 1.3, 0.3, 1.0],
                        backgroundColor: 'rgba(16, 185, 129, 0.45)',
                        borderColor: '#10B981',
                        borderWidth: 1.5,
                        yAxisID: 'y'
                    }
                ];
                scadaChartInstance.options.scales.y.max = 12;
                scadaChartInstance.options.scales.y.title.text = 'Outage Duration (Days)';
                scadaChartInstance.options.scales.y1.display = false;
                if (scadaChartInstance.options.scales.y2) scadaChartInstance.options.scales.y2.display = false;
                scadaChartInstance.update();
            }
        }
    }

    // Attach MATLAB simulation triggers to buttons
    runSimButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const card = e.currentTarget.closest('.simulation-card');
            if (card) {
                const simMode = card.getAttribute('data-sim');
                
                // Load Simulation Config
                loadSimulationMode(simMode);
                
                // Scroll to dashboard smoothly
                const dashboardSec = document.getElementById('dashboard');
                if (dashboardSec) {
                    window.scrollTo({
                        top: dashboardSec.offsetTop - 80,
                        behavior: 'smooth'
                    });
                }
            }
        });
    });

    // ==========================================================================
    // 9. RESULTS SECTION BAR CHART PLOTTING
    // ==========================================================================
    const resultsCtx = document.getElementById('resultsComparisonChart');
    if (resultsCtx) {
        const gradientRed = resultsCtx.getContext('2d').createLinearGradient(0, 0, 0, 300);
        gradientRed.addColorStop(0, 'rgba(239, 68, 68, 0.4)');
        gradientRed.addColorStop(1, 'rgba(239, 68, 68, 0.05)');

        const gradientGreen = resultsCtx.getContext('2d').createLinearGradient(0, 0, 0, 300);
        gradientGreen.addColorStop(0, 'rgba(16, 185, 129, 0.4)');
        gradientGreen.addColorStop(1, 'rgba(16, 185, 129, 0.05)');

        new Chart(resultsCtx, {
            type: 'bar',
            data: {
                labels: ['Line #1 (Heating)', 'Line #2 (Solder)', 'Line #3 (Glass)', 'Line #4 (Lam)', 'Line #5 (Trim)', 'Line #6 (Framing)'],
                datasets: [
                    {
                        label: 'Standard Preventive Schedule (Downtime Hrs)',
                        data: [154, 182, 120, 196, 144, 110],
                        backgroundColor: gradientRed,
                        borderColor: '#EF4444',
                        borderWidth: 2,
                        borderRadius: 6
                    },
                    {
                        label: 'AI-Predictive Maintenance (Downtime Hrs)',
                        data: [115, 136, 92, 142, 108, 82],
                        backgroundColor: gradientGreen,
                        borderColor: '#10B981',
                        borderWidth: 2,
                        borderRadius: 6
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: '#94A3B8',
                            font: { family: 'Inter', size: 11 }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { color: 'rgba(255, 255, 255, 0.04)' },
                        ticks: { color: '#94A3B8' }
                    },
                    y: {
                        grid: { color: 'rgba(255, 255, 255, 0.04)' },
                        ticks: { color: '#94A3B8' },
                        title: { display: true, text: 'Total Annual Downtime (Hours)', color: '#94A3B8' }
                    }
                }
            }
        });
    }



    // ==========================================================================
    // 11. TAB TOGGLING AND REAL-TIME CSV TELEMETRY PLAYER
    // ==========================================================================
    const tabSliders = document.getElementById('tab-btn-sliders');
    const tabCsv = document.getElementById('tab-btn-csv');
    const tabDb = document.getElementById('tab-btn-db');
    const paneSliders = document.getElementById('sliders-control-pane');
    const paneCsv = document.getElementById('csv-control-pane');
    const paneDb = document.getElementById('db-control-pane');

    if (tabSliders && tabCsv && tabDb && paneSliders && paneCsv && paneDb) {
        tabSliders.addEventListener('click', () => {
            tabSliders.classList.add('active');
            tabCsv.classList.remove('active');
            tabDb.classList.remove('active');
            paneSliders.classList.remove('hidden');
            paneCsv.classList.add('hidden');
            paneDb.classList.add('hidden');
        });

        tabCsv.addEventListener('click', () => {
            tabCsv.classList.add('active');
            tabSliders.classList.remove('active');
            tabDb.classList.remove('active');
            paneCsv.classList.remove('hidden');
            paneSliders.classList.add('hidden');
            paneDb.classList.add('hidden');
        });

        tabDb.addEventListener('click', () => {
            tabDb.classList.add('active');
            tabSliders.classList.remove('active');
            tabCsv.classList.remove('active');
            paneDb.classList.remove('hidden');
            paneSliders.classList.add('hidden');
            paneCsv.classList.add('hidden');
            loadDbHistory();
        });
    }

    // CSV Telemetry Stream variables
    let csvPlayInterval = null;
    let csvDataList = [];
    let csvCurrentIndex = 0;

    const btnPlayCsv = document.getElementById('btn-play-csv');
    const btnStopCsv = document.getElementById('btn-stop-csv');
    const csvDataInput = document.getElementById('csv-data-input');
    const csvStatusText = document.getElementById('csv-status-text');
    const csvProgressText = document.getElementById('csv-progress-text');

    function parseCSVText(text) {
        const rows = text.trim().split('\n');
        if (rows.length < 2) return [];
        
        const headers = rows[0].split(',').map(h => h.trim());
        const data = [];
        
        for (let i = 1; i < rows.length; i++) {
            const values = rows[i].split(',').map(v => v.trim());
            if (values.length === headers.length) {
                const record = {};
                headers.forEach((header, idx) => {
                    const val = values[idx];
                    record[header] = isNaN(val) ? val : parseFloat(val);
                });
                data.push(record);
            }
        }
        return data;
    }

    function stopCsvStream() {
        if (csvPlayInterval) {
            clearInterval(csvPlayInterval);
            csvPlayInterval = null;
        }
        if (btnPlayCsv) btnPlayCsv.disabled = false;
        if (btnStopCsv) btnStopCsv.disabled = true;
        if (csvStatusText) {
            csvStatusText.textContent = "IDLE";
            csvStatusText.className = "text-cyan";
        }
        appendLog("CSV hardware telemetry stream halted.", "warning");
        
        // Restore standard telemetry monitoring loop
        currentMode = 'health';
        if (activeModeDisplay) {
            activeModeDisplay.innerHTML = `<i data-lucide="activity"></i> PV Module Health Monitoring`;
        }
        lucide.createIcons();
        startLiveTelemetryTrend();
    }

    function startCsvStream() {
        // Parse CSV data
        const rawCsv = csvDataInput ? csvDataInput.value : '';
        csvDataList = parseCSVText(rawCsv);
        
        if (csvDataList.length === 0) {
            alert("No valid telemetry CSV rows detected. Please check headers and values!");
            return;
        }

        // Stop standard live telemetry loops
        if (updateIntervalTimer) clearInterval(updateIntervalTimer);
        if (csvPlayInterval) clearInterval(csvPlayInterval);
        
        currentMode = 'csv-playback';
        csvCurrentIndex = 0;
        
        if (activeModeDisplay) {
            activeModeDisplay.innerHTML = `<i data-lucide="database"></i> CSV Hardware Stream`;
        }
        lucide.createIcons();

        if (btnPlayCsv) btnPlayCsv.disabled = true;
        if (btnStopCsv) btnStopCsv.disabled = false;
        if (csvStatusText) {
            csvStatusText.textContent = "STREAMING...";
            csvStatusText.className = "text-emerald";
        }

        appendLog(`CSV hardware telemetry initiated: ${csvDataList.length} rows loaded.`, "success");

        csvPlayInterval = setInterval(() => {
            if (csvCurrentIndex >= csvDataList.length) {
                // Playback complete
                appendLog("CSV hardware telemetry stream complete. Returning to live mode.", "success");
                stopCsvStream();
                return;
            }

            const record = csvDataList[csvCurrentIndex];
            
            // Extract values
            const temp = record.Temperature_C || record.temperature || 45.0;
            const volt = record.Voltage_V || record.voltage || 38.0;
            const curr = record.Current_A || record.current || 8.5;
            const irrad = record.Solar_Irradiance || record.irradiance || calculateIrradiance(temp, curr, volt);
            
            // Use Health & Failure overrides from CSV if available
            const health = record.Panel_Health || record.health || record.Machine_Health || 98;
            const failure = record.Failure_Probability || record.failure || 2;
            const status = record.Status || record.status || 'Normal';

            // Sync Sliders positions
            if (sliderTemp) sliderTemp.value = temp;
            if (sliderVolt) sliderVolt.value = volt;
            if (sliderCurr) sliderCurr.value = curr;
            if (sliderIrrad) sliderIrrad.value = Math.round(irrad);

            // Sync Gauges & metrics
            updateDashboardUI(temp, volt, curr, irrad, false);

            // Save telemetry snapshot to database
            saveTelemetryToDB(temp, volt, curr, irrad, health, failure, status, 'csv');

            // Directly overwrite KPIs with CSV's exact custom values!
            if (kpiHealth) kpiHealth.textContent = `${health}%`;
            if (kpiProb) kpiProb.textContent = `${failure}%`;
            
            const csvRul = (health / 100) * 25;
            if (kpiRul) kpiRul.textContent = health <= 10 ? 'DECOMMISSIONED' : `${csvRul.toFixed(1)} Yrs`;
            
            const kpiDowntime = document.getElementById('kpi-downtime');
            const csvDowntime = 12.0 + (100 - health) * 0.75;
            if (kpiDowntime) kpiDowntime.textContent = `${csvDowntime.toFixed(1)} Days`;
            
            // Style health text
            if (kpiHealth) {
                kpiHealth.className = 'kpi-num font-display ' + (health > 80 ? 'text-emerald' : health > 50 ? 'text-warning' : 'text-danger');
            }

            // Sync AI indicator state directly with CSV status
            const statusLower = status.toLowerCase();
            if (aiIndicator && aiTitle && aiIcon) {
                if (statusLower === 'normal') {
                    aiIndicator.className = 'ai-status-card healthy';
                    aiTitle.textContent = 'NORMAL';
                    aiIcon.setAttribute('data-lucide', 'shield-check');
                } else if (statusLower === 'warning') {
                    aiIndicator.className = 'ai-status-card warning';
                    aiTitle.textContent = 'WARNING: DEGRADATION';
                    aiIcon.setAttribute('data-lucide', 'alert-triangle');
                } else if (statusLower === 'critical') {
                    aiIndicator.className = 'ai-status-card critical';
                    aiTitle.textContent = 'CRITICAL ANOMALY';
                    aiIcon.setAttribute('data-lucide', 'flame');
                } else if (statusLower === 'failure') {
                    aiIndicator.className = 'ai-status-card critical';
                    aiTitle.textContent = 'HARDWARE FAILURE';
                    aiIcon.setAttribute('data-lucide', 'zap-off');
                }
                lucide.createIcons();
            }

            // Push CSV telemetry directly to Live Chart.js datasets
            chartTimeLabels.push(`Row-${record.Timestamp}`);
            chartTimeLabels.shift();
            
            trendDataTemp.push(temp);
            trendDataVolt.push(volt);
            trendDataCurr.push(curr);
            trendDataIrrad.push(irrad);
            trendDataHealth.push(health);
            
            trendDataTemp.shift();
            trendDataVolt.shift();
            trendDataCurr.shift();
            trendDataIrrad.shift();
            trendDataHealth.shift();

            if (scadaChartInstance && scadaChartInstance.config.type === 'line') {
                scadaChartInstance.update('none');
            }

            // Log details
            appendLog(`[CSV-RX] Packet #${record.Timestamp}: Temp=${temp}°C, Volt=${volt}V, Curr=${curr}A, G=${irrad.toFixed(0)}W/m²`, 
                      statusLower === 'normal' ? 'success' : statusLower === 'warning' ? 'warning' : 'danger');

            // Update Progress UI
            csvCurrentIndex++;
            if (csvProgressText) {
                csvProgressText.textContent = `Stream progress: ${csvCurrentIndex}/${csvDataList.length} packets`;
            }

        }, 1000);
    }

    if (btnPlayCsv) {
        btnPlayCsv.addEventListener('click', startCsvStream);
    }
    if (btnStopCsv) {
        btnStopCsv.addEventListener('click', stopCsvStream);
    }

    // Live IoT Hardware WebSocket Connection
    function connectHardwareSocket() {
        const hardwareSocket = new WebSocket('ws://localhost:8080/sensor-stream');

        hardwareSocket.onopen = () => {
            appendLog("Live IoT Hardware connection established on port 8080.", "success");
        };

        hardwareSocket.onmessage = (event) => {
            try {
                const payload = JSON.parse(event.data);
                
                // Extract values from hardware packet
                const temp = parseFloat(payload.Temperature_C || payload.temperature || 45.0);
                const volt = parseFloat(payload.Voltage_V || payload.voltage || 38.0);
                const curr = parseFloat(payload.Current_A || payload.current || 8.5);
                const irrad = parseFloat(payload.Solar_Irradiance || payload.irradiance || calculateIrradiance(temp, curr, volt));

                // Stop standard live simulation updates while hardware is actively streaming
                if (currentMode !== 'iot-hardware') {
                    if (updateIntervalTimer) clearInterval(updateIntervalTimer);
                    if (csvPlayInterval) {
                        clearInterval(csvPlayInterval);
                        csvPlayInterval = null;
                        if (btnPlayCsv) btnPlayCsv.disabled = false;
                        if (btnStopCsv) btnStopCsv.disabled = true;
                    }
                    currentMode = 'iot-hardware';
                    if (activeModeDisplay) {
                        activeModeDisplay.innerHTML = `<i data-lucide="wifi"></i> Live IoT Hardware Stream`;
                    }
                    lucide.createIcons();
                    appendLog("IoT Hardware stream active. Standard simulation paused.", "success");
                }

                // Sync sliders visually
                if (sliderTemp) sliderTemp.value = temp;
                if (sliderVolt) sliderVolt.value = volt;
                if (sliderCurr) sliderCurr.value = curr;
                if (sliderIrrad) sliderIrrad.value = Math.round(irrad);

                // Feed directly into the dashboard evaluator
                updateDashboardUI(temp, volt, curr, irrad, true);
                
                // Rate-limited save to DB (every 5 packets) to avoid overloading
                if (typeof this.iotCount === 'undefined') this.iotCount = 0;
                this.iotCount++;
                if (this.iotCount % 5 === 0) {
                    const metrics = evaluateTelemetry(temp, volt, curr, irrad);
                    saveTelemetryToDB(temp, volt, curr, irrad, metrics.healthVal, metrics.failureProb, metrics.status, 'iot');
                }
                
            } catch (err) {
                console.error("Failed to parse IoT payload:", err);
            }
        };

        hardwareSocket.onerror = (error) => {
            // Suppress browser console crash warnings by handling errors
        };

        hardwareSocket.onclose = () => {
            if (currentMode === 'iot-hardware') {
                appendLog("Live IoT Hardware connection lost. Restoring standard simulation...", "warning");
                // Restore standard telemetry monitoring loop
                currentMode = 'health';
                if (activeModeDisplay) {
                    activeModeDisplay.innerHTML = `<i data-lucide="activity"></i> PV Module Health Monitoring`;
                }
                lucide.createIcons();
                startLiveTelemetryTrend();
            }
            // Reconnect after 5 seconds
            setTimeout(connectHardwareSocket, 5000);
        };
    }

    // Initial Dashboard Setup and Telemetry Stream loop activation
    const initialIrrad = 800;
    if (sliderIrrad) sliderIrrad.value = initialIrrad;
    updateDashboardUI(45, 38.0, 8.5, initialIrrad, false);
    initSCADAChart();
    startLiveTelemetryTrend();
    connectHardwareSocket();
});
