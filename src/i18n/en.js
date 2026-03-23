export default {
  // Header
  "app.title": "Kp Tracker",
  "app.subtitle": "Geomagnetic Activity Monitor",
  "app.updated": "Updated",
  "app.loading": "Loading...",

  // Alert Banner
  "alert.extreme": "Kp {kp} — Severe geomagnetic storm! Take care of yourself.",
  "alert.strong": "Kp {kp} — Strong geomagnetic storm in progress.",
  "alert.moderate": "Kp {kp} — Moderate storm. You might feel this one.",
  "alert.minor": "Kp {kp} — Minor storm conditions. Pay attention to how you feel.",
  "alert.threshold": "Kp {kp} — Above your threshold (Kp {threshold}). Check in with yourself.",

  // Kp Gauge
  "kp.current": "Current Kp",
  "kp.index": "Kp Index",
  "kp.window": "3h Window",
  "kp.localTime": "Local Time",
  "kp.yourThreshold": "Your Threshold",
  "kp.active": "ACTIVE",
  "kp.quiet": "Quiet",
  "kp.unsettled": "Active",
  "kp.minorStorm": "Minor Storm (G1)",
  "kp.moderateStorm": "Moderate Storm (G2)",
  "kp.strongStorm": "Strong Storm (G3)",
  "kp.severeStorm": "Severe Storm (G4)",
  "kp.extremeStorm": "Extreme Storm (G5)",

  // Solar Wind
  "sw.title": "Solar Wind",
  "sw.source": "DSCOVR L1",
  "sw.speed": "Speed (km/s)",
  "sw.bz": "Bz (nT)",
  "sw.bzSouth": "South",
  "sw.bzNorth": "North",
  "sw.density": "Density (p/cm³)",
  "sw.bt": "Bt (nT)",
  "sw.stormLikely": "Storm conditions likely — Bz strongly southward with high speed",
  "sw.elevated": "Elevated activity expected — Bz southward",
  "sw.moderate": "Moderate conditions — fast wind with slight southward Bz",
  "sw.fastWind": "Fast solar wind stream detected",

  // Chart
  "chart.title": "Kp History & Forecast",
  "chart.24h": "24h",
  "chart.3d": "3 Days",
  "chart.7d": "7 Days",
  "chart.quiet": "Quiet (0-3)",
  "chart.unsettled": "Unsettled (4)",
  "chart.storm": "Storm (5-6)",
  "chart.severe": "Severe (7+)",
  "chart.forecast": "Forecast",

  // Symptom Tracker
  "tracker.title": "Symptom Tracker",
  "tracker.logEntry": "+ Log Entry",
  "tracker.cancel": "Cancel",
  "tracker.save": "Save Entry",
  "tracker.empty": "No entries yet. Start tracking to find your patterns.",
  "tracker.severity": "Overall Severity",
  "tracker.symptoms": "Symptoms",
  "tracker.sleep": "Sleep",
  "tracker.hydration": "Hydration",
  "tracker.caffeine": "Caffeine",
  "tracker.stress": "Stress Level",
  "tracker.weather": "Weather / Pressure Notes",
  "tracker.weatherPlaceholder": "e.g. rainy, pressure drop...",
  "tracker.notes": "Notes",
  "tracker.notesPlaceholder": "Anything else...",
  "tracker.currentKp": "Current Kp",
  "tracker.savedWith": "Will be saved with this entry",
  "tracker.deleteTitle": "Delete entry",

  // Symptoms
  "symptom.headache": "Headache",
  "symptom.fatigue": "Fatigue",
  "symptom.dizziness": "Dizziness",
  "symptom.nausea": "Nausea",
  "symptom.anxiety": "Anxiety",
  "symptom.brain_fog": "Brain Fog",
  "symptom.palpitations": "Palpitations",
  "symptom.insomnia": "Insomnia",
  "symptom.irritability": "Irritability",
  "symptom.joint_pain": "Joint Pain",
  "symptom.malaise": "Malaise",

  // Sleep options
  "sleep.great": "Great",
  "sleep.good": "Good",
  "sleep.fair": "Fair",
  "sleep.poor": "Poor",
  "sleep.terrible": "Terrible",

  // Hydration options
  "hydration.well": "Well",
  "hydration.moderate": "Moderate",
  "hydration.poor": "Poor",

  // Caffeine options
  "caffeine.none": "None",
  "caffeine.light": "1-2 cups",
  "caffeine.moderate": "3-4 cups",
  "caffeine.heavy": "5+",

  // Stress options
  "stress.low": "Low",
  "stress.moderate": "Moderate",
  "stress.high": "High",
  "stress.extreme": "Extreme",

  // Correlation
  "corr.title": "Your Patterns",
  "corr.empty": "Log at least 3 entries to see correlation patterns.",
  "corr.totalEntries": "Total Entries",
  "corr.severityDiff": "Severity Diff (High vs Low Kp)",
  "corr.avgHigh": "Avg Severity (Kp ≥ 4)",
  "corr.avgLow": "Avg Severity (Kp < 4)",
  "corr.entries": "entries",
  "corr.topSymptoms": "Most Common Symptoms During Kp ≥ 4",
  "corr.notable": "Your data shows a notable pattern: you report higher severity ({high} avg) during high Kp conditions vs {low} avg on quiet days. Keep logging to strengthen this pattern.",
  "corr.mild": "There's a mild trend in your data — slightly higher severity during elevated Kp. More entries will help clarify if this is consistent.",
  "corr.none": "So far, your data doesn't show a strong difference between high and low Kp days. Keep tracking — patterns may emerge with more data points.",

  // Info
  "info.title": "About the Kp Index",
  "info.show": "Show",
  "info.hide": "Hide",
  "info.whatIsKp": "What is Kp?",
  "info.whatIsKpText": "The Planetary Kp Index measures Earth's magnetic field disturbance on a scale of 0-9. It is calculated from data at 13 stations worldwide, updated every 3 hours (8 windows per day).",
  "info.quiet": "Quiet — no disturbance",
  "info.active": "Active — noticeable",
  "info.stormG1G2": "Storm (G1-G2)",
  "info.severeG3G5": "Severe (G3-G5)",

  // Settings
  "settings.title": "Settings",
  "settings.threshold": "Alert Threshold (Kp)",
  "settings.thresholdHint": "Alert banner appears when Kp reaches this level.",
  "settings.timezone": "Timezone",
  "settings.tzBulgaria": "Bulgaria (EET/EEST)",
  "settings.tzLocal": "Local (Browser)",
  "settings.tzLondon": "London (GMT/BST)",
  "settings.tzBerlin": "Berlin (CET/CEST)",
  "settings.tzNewYork": "New York (EST/EDT)",
  "settings.refresh": "Data Refresh",
  "settings.every1m": "Every minute",
  "settings.every2m": "Every 2 minutes",
  "settings.every5m": "Every 5 minutes",
  "settings.data": "Data",
  "settings.export": "Export Logs",
  "settings.import": "Import Logs",
  "settings.danger": "Danger Zone",
  "settings.clear": "Clear All Logs",
  "settings.clearConfirm": "Delete all logged entries? This cannot be undone.",
  "settings.language": "Language",

  // Footer
  "footer.dataFrom": "Data from",
  "footer.autoRefresh": "Auto-refreshes every {seconds}s.",
  "footer.disclaimer": "Not a medical tool. If you experience severe symptoms, seek medical care.",

  // General
  "general.select": "-- Select --",
}
