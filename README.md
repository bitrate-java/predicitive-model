# AegisPV: AI-Based Predictive Maintenance for PV Manufacturing Equipment

AegisPV is a state-of-the-art, responsive, and interactive Industry 4.0 digital twin dashboard combined with a modern startup landing page. It showcases how Artificial Intelligence, Machine Learning, and Real-Time IoT sensor telemetry predict manufacturing anomalies, minimize downtime, and optimize lamination machinery in solar photovoltaic (PV) assembly lines.

![Dashboard Preview](https://img.shields.io/badge/Industry_4.0-Enabled-blue?style=for-the-badge&logo=industry)
![Stack](https://img.shields.io/badge/Tech_Stack-HTML5_/_CSS3_/_JS-orange?style=for-the-badge)
![Analytics](https://img.shields.io/badge/Analytics-Chart.js_&_Lucide-cyan?style=for-the-badge)

---

## 🚀 Live SCADA Digital Twin Console

The heart of AegisPV is its commercial-grade industrial digital twin dashboard, featuring:
* **Real-Time Telemetry Gauges**: Custom SVG radial dials visualizing Temperature (°C), Vibration (mm/s²), and Load Current (A) directly from virtual or physical sensors.
* **Dual-Mode Analytical Trends**: Visual telemetry graphs plotting continuous variables or custom analytical models (Confusion Matrix, RUL degradation curves, downtime optimization charts) using Chart.js.
* **Dynamic AI Decision System**: Embedded classifier logic that evaluates sensor states to transition the system between **Normal** (Safe), **Warning** (Degraded), and **Critical** (Failure imminent) states, printing real-time diagnostic recommendations.
* **Sensor Anomaly Injector**: Manual override sliders allowing users to simulate equipment wear and watch the AI dashboard trigger state updates.
* **Real-Time CSV Hardware Streamer**: A CSV playback interface that parses raw sensor data rows second-by-second, simulating actual hardware runs.

---

## 📂 Project Architecture

```
pv-predictive-maintenance/
├── index.html        # Main landing page & SCADA UI shell
├── styles.css        # Premium dark-navy design system & glassmorphism layout
├── app.js            # Live simulation logic, Chart.js trends, & CSV Streamer
└── README.md         # Documentation
```

---

## ⚙️ How It Works (AI Logic)

The system relies on virtual sensor inputs mapped against mathematical degradation models (Decision Trees / Random Forest ensembles):
1. **Normal Range**: Temperature ($20\text{--}80^\circ\text{C}$), Vibration ($0.1\text{--}2.5\text{ mm/s}^2$), Load Current ($5.0\text{--}15.0\text{ A}$).
2. **Warning Thresholds**: Triggered when Temperature $> 80^\circ\text{C}$ or Vibration $> 2.5\text{ mm/s}^2$. The AI outputs instructions to verify bearing wear or check cooling pipelines.
3. **Critical / Failure Thresholds**: Triggered when Temperature $> 100^\circ\text{C}$, Vibration $> 4.0\text{ mm/s}^2$, or Load Current $> 20\text{ A}$. The UI flashes alert beacons and recommends an emergency shutdown.

---

## 📊 CSV Playback Stream Format

You can stream your own CSV telemetry logs through the interface. The parser supports the following format:

```csv
Timestamp,Temperature_C,Vibration_mm_s2,Current_A,Machine_Health,Failure_Probability,Status
1,42,0.8,7.2,98,2,Normal
2,58,1.8,9.0,87,15,Warning
3,82,4.2,13.2,50,65,Critical
4,115,7.0,22.0,5,99,Failure
```

Simply paste your comma-separated rows into the **CSV Stream** text console on the dashboard and click **Stream CSV** to witness real-time telemetric updates.

---

## 🛠️ Installation & Local Development

Since this is a lightweight, high-performance static web application, it does not require external database setups or heavy npm installations to run locally.

1. **Clone the repository**:
   ```bash
   git clone https://github.com/YOUR_USERNAME/pv-predictive-maintenance.git
   cd pv-predictive-maintenance
   ```
2. **Launch the platform**:
   * Open `index.html` directly in any web browser.
   * *Or*, run a local development server for a smoother experience:
     ```bash
     # If you have Python installed:
     python -m http.server 8000
     
     # Or using Node.js:
     npx serve
     ```
     Then navigate to `http://localhost:8000` or `http://localhost:3000`.

---

## 🛡️ License

Distributed under the MIT License. See `LICENSE` for more information.
