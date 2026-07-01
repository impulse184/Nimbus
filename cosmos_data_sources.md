# Cosmic Section Data Sources & Telemetry Guide

This document provides a comprehensive list of all data sources, update frequencies, mathematical calculations, and fallback mechanisms used in the **Cosmos & Space Weather** dashboard.

---

## 1. Space Weather & Solar Wind
* **Primary Source:** National Oceanic and Atmospheric Administration (NOAA) Space Weather Prediction Center.
* **Endpoints:**
  * **Planetary Kp-Index:** `https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json`
  * **Solar Wind Plasma:** `https://services.swpc.noaa.gov/products/solar-wind/plasma-5-minute.json`
* **Update Frequency:** 
  * The Kp-index updates every **3 hours**.
  * Solar wind plasma updates every **5 minutes**.
* **Cache Lifetime:** **5 minutes** (to reduce network traffic and prevent API rate-limiting).
* **Fallback Mode:** If NOAA servers are unreachable, the app transitions to a **procedural model** simulating solar activity based on coordinates (observer latitude) and sinusoidal time oscillations:
  * $\text{Solar Speed} \approx 340 + (\text{Latitude} \times 3.2) + \sin(\text{Time}) \times 40\text{ km/s}$
  * $\text{Proton Density} \approx 3.2 + (\text{Latitude} / 90) \times 4.5 + \text{random}(0..2)\text{ p/cm}^3$
  * $\text{Kp Index} \approx \text{clamp}(1 + (\text{Latitude} / 90) \times 4.5 + \text{random}(0..2), 0, 9)$

---

## 2. International Space Station (ISS) Tracker
* **Primary Source:** `wheretheiss.at` satellite tracking service.
* **Endpoint:** `https://api.wheretheiss.at/v1/satellites/25544`
* **Update Frequency:** Real-time polling.
* **Cache Lifetime:** **15 seconds** (to keep live indicators accurate while conserving API limits).
* **Calculated Values:**
  * **Distance:** Calculated using the **Haversine Formula** between the user's current city latitude/longitude and the current live coordinates of the ISS.
  * **General Direction (Compass Bearing):** Calculated using the spherical direction formula:
    $$\theta = \text{atan2}( \sin(\Delta \lambda) \cdot \cos(\phi_2), \cos(\phi_1) \cdot \sin(\phi_2) - \sin(\phi_1) \cdot \cos(\phi_2) \cdot \cos(\Delta \lambda) )$$
    where $\phi_1, \lambda_1$ are the observer's coordinates and $\phi_2, \lambda_2$ are the ISS's coordinates. Normalized to $0..360^\circ$ and mapped to cardinal/ordinal directions (e.g. *Look Southwest*).
  * **Elevation Angle:** Estimated based on ground distance:
    $$\text{Elevation} = \max\left(0, \min\left(90, 90 - \frac{\text{Distance}}{35}\right)\right)$$
* **Fallback Mode:** When the ISS is below the horizon ($>2000\text{ km}$ distance) or when offline, the next overhead pass is procedurally calculated for Tonight at 9:42 PM (lasting 5m 24s).

---

## 3. Starlink Chain Tracker
* **Data Origin:** Procedural orbital propagation.
* **Update Frequency:** Calculated on load and refreshed dynamically when switching locations.
* **Pass Time:** Derived from upcoming pass mechanics starting at 10:15 PM (22:15) with a 7-hour recurrence interval.
* **Elevation:** Derived from observer latitude:
  $$\text{Elevation} = 20^\circ + (\text{Latitude} \times 0.2)$$
* **Legibility Enhancement:** Starlink telemetry is highlighted in bright **lavender** (`#c084fc`) to guarantee visual clarity on all dark screens.

---

## 4. Stargazing Quality Dial
* **Data Sources:** Combined local cloud cover and lunar cycle calculations.
* **Lunar Phase Algorithm:** Calculates lunar age based on Unix epoch time:
  $$\text{Moon Age} = (\text{Unix Time} - \text{Epoch}) \pmod{29.530588853\text{ days}}$$
  $$\text{Moon Illumination} = \text{round}\left((1 - \cos(\text{Moon Age Ratio} \times 2\pi)) \times 50\right)$$
* **Stargazing Index Calculation:**
  $$\text{Index} = \max\left(5, \min\left(100, 100 - (0.5 \times \text{Clouds}) - (0.45 \times \text{Moon Illumination})\right)\right)$$
* **Observing Quality Thresholds:**
  * **Obscured:** Clouds $> 60\%$
  * **Moon Washout:** Moon illumination $> 70\%$
  * **Excellent:** Stargazing index $\ge 80\%$ (pristine dark skies)
  * **Fair:** Default clear/moderate conditions.

---

## 5. Aurora Probability Ring
* **Data Sources:** Observer latitude, local cloud cover, and live Kp-index strength.
* **Algorithm:**
  1. Determines base probability based on geographic latitude (magnetic oval proximity):
     * $60^\circ \text{ to } 75^\circ$ Latitude: Base probability $\approx 75\%$
     * $45^\circ \text{ to } 60^\circ$ Latitude: Base probability $\approx 25\%$
     * $35^\circ \text{ to } 45^\circ$ Latitude: Base probability $\approx 5\%$
     * $< 35^\circ$ Latitude (e.g. Patna): Base probability $\approx 0\%$
  2. Applies geomagnetic solar wind scaling:
     $$\text{Geomagnetic Scale} = 0.5 + \left(\frac{\text{Kp}}{9} \times 0.8\right)$$
  3. Applies cloud obscuration penalty:
     $$\text{Final Probability} = \text{round}(\min(\text{Base} \times \text{Geomagnetic Scale}, 100) \times (1 - \text{Clouds}/100))$$
* **Low-Latitude Patna Override:** For locations under $35^\circ$ latitude, the probability is locked to **0%** and the reason explains: *"Auroras are not visible at this low latitude due to no geomagnetic activity reaching this region."* rather than blaming local cloud cover.

---

## 6. Meteor Showers Tracker
* **Data Sources:** Static database of major annual meteor showers, active dates, zenith hourly rates (ZHR), entry velocities, and parent comet/asteroid bodies.
* **Annual Showers Monitored:**
  * **Quadrantids** (Dec 28 - Jan 12, Peak ZHR: 120, Speed: 41 km/s, Parent: 2003 EH1)
  * **Lyrids** (Apr 14 - Apr 30, Peak ZHR: 18, Speed: 49 km/s, Parent: Comet Thatcher)
  * **Eta Aquariids** (Apr 19 - May 28, Peak ZHR: 50, Speed: 66 km/s, Parent: Halley's Comet)
  * **Perseids** (Jul 17 - Aug 24, Peak ZHR: 100, Speed: 59 km/s, Parent: Comet Swift-Tuttle)
  * **Orionids** (Oct 2 - Nov 7, Peak ZHR: 20, Speed: 66 km/s, Parent: Halley's Comet)
  * **Leonids** (Nov 6 - Nov 30, Peak ZHR: 15, Speed: 71 km/s, Parent: Comet Tempel-Tuttle)
  * **Geminids** (Dec 4 - Dec 20, Peak ZHR: 150, Speed: 35 km/s, Parent: 3200 Phaethon)
  * **Ursids** (Dec 17 - Dec 26, Peak ZHR: 10, Speed: 33 km/s, Parent: Comet Tuttle)
* **Visual Quality Factors:** Modulated by latitude (e.g. Perseids are less visible in the Southern hemisphere) and attenuated by local cloud cover and moon illumination.

---

## 7. Solar & Sunset/Sunrise Timeline
* **Data Source:** OpenWeatherMap One Call / Current Weather APIs.
* **Update Frequency:** Dynamically updated on every city search or refresh.
* **Visuals:** Computes solar altitude angle and outputs beautiful orbital animations depicting solar position relative to the local horizon line.
