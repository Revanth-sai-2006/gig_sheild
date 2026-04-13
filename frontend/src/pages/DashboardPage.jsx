import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import GigShieldLogo from "../components/GigShieldLogo";
import StatCard from "../components/StatCard";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { automationApi, claimApi, policyApi } from "../services/api";

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const shellRef = useRef(null);
  const toastTimerRef = useRef(null);
  const [now, setNow] = useState(() => Date.now());
  const [catalog, setCatalog] = useState([]);
  const [activePolicies, setActivePolicies] = useState([]);
  const [claims, setClaims] = useState([]);
  const [payoutGateways, setPayoutGateways] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [automation, setAutomation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [reviewingClaimId, setReviewingClaimId] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState("");
  const [authToast, setAuthToast] = useState("");
  const [manualClaim, setManualClaim] = useState({
    policyId: "",
    claimType: "weather_disruption",
    description: "",
    amount: 100,
    payoutGateway: "razorpay_test",
    claimedWeather: "",
    reportedLocationLat: "",
    reportedLocationLon: "",
    deliveryLocationLat: "",
    deliveryLocationLon: ""
  });

  const firstName = useMemo(() => user?.name?.trim()?.split(/\s+/)[0] || "there", [user?.name]);

  const refreshData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [catalogRes, activeRes, claimsRes, automationRes, metricsRes, gatewaysRes] = await Promise.all([
        policyApi.list(),
        policyApi.active(),
        claimApi.list(),
        automationApi.status(),
        claimApi.metrics(),
        claimApi.gateways()
      ]);

      setCatalog(catalogRes.data);
      setActivePolicies(activeRes.data);
      setClaims(claimsRes.data);
      setAutomation(automationRes.data);
      setMetrics(metricsRes.data);
      setPayoutGateways(gatewaysRes.data || []);
      if (!manualClaim.policyId && activeRes.data.length > 0) {
        setManualClaim((prev) => ({ ...prev, policyId: activeRes.data[0].id }));
      }
      if (!manualClaim.payoutGateway && (gatewaysRes.data || []).length > 0) {
        setManualClaim((prev) => ({ ...prev, payoutGateway: gatewaysRes.data[0].code }));
      }
    } catch (apiError) {
      setError(apiError?.response?.data?.message || "Failed to load dashboard data");
    } finally {
      setLoading(false);
      setLastUpdated(new Date());
    }
  }, [manualClaim.policyId]);

  const showToast = useCallback((message) => {
    setAuthToast(message);

    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }

    toastTimerRef.current = setTimeout(() => {
      setAuthToast("");
      toastTimerRef.current = null;
    }, 2800);
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  useEffect(() => {
    const flash = sessionStorage.getItem("swi_auth_flash");
    if (!flash) {
      return undefined;
    }

    showToast(flash);
    sessionStorage.removeItem("swi_auth_flash");
    return undefined;
  }, [showToast]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const tickerClock = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(tickerClock);
  }, []);

  const buyPolicy = async (policyId) => {
    setError("");
    try {
      await policyApi.purchase(policyId);
      const selected = catalog.find((policy) => policy.id === policyId);
      showToast(`You've chosen ${selected?.name || "this policy"}.`);
      await refreshData();
    } catch (apiError) {
      setError(apiError?.response?.data?.message || "Could not purchase policy");
    }
  };

  const submitClaim = async (event) => {
    event.preventDefault();
    setError("");

    try {
      const reportedLocation =
        manualClaim.reportedLocationLat !== "" && manualClaim.reportedLocationLon !== ""
          ? {
              lat: Number(manualClaim.reportedLocationLat),
              lon: Number(manualClaim.reportedLocationLon)
            }
          : undefined;

      const deliveryLocation =
        manualClaim.deliveryLocationLat !== "" && manualClaim.deliveryLocationLon !== ""
          ? {
              lat: Number(manualClaim.deliveryLocationLat),
              lon: Number(manualClaim.deliveryLocationLon)
            }
          : undefined;

      const { data: createdClaim } = await claimApi.create({
        policyId: manualClaim.policyId,
        claimType: manualClaim.claimType,
        description: manualClaim.description,
        amount: Number(manualClaim.amount),
        payoutGateway: manualClaim.payoutGateway,
        claimedWeather: manualClaim.claimedWeather || undefined,
        reportedLocation,
        deliveryLocation,
        triggerCodes: automation?.triggers?.map((trigger) => trigger.code) || []
      });
      setManualClaim((prev) => ({
        ...prev,
        description: "",
        amount: 100,
        payoutGateway: prev.payoutGateway || "razorpay_test",
        claimedWeather: "",
        reportedLocationLat: "",
        reportedLocationLon: "",
        deliveryLocationLat: "",
        deliveryLocationLon: ""
      }));
      if (createdClaim?.status === "approved") {
        showToast("Claim approved successfully. Payout is processing.");
      } else if (createdClaim?.status === "pending") {
        showToast("Claim submitted successfully and is pending review.");
      } else if (createdClaim?.status === "rejected") {
        showToast("Claim rejected. Please review claim details and try again.");
      } else {
        showToast("Claim submitted successfully.");
      }
      await refreshData();
    } catch (apiError) {
      setError(apiError?.response?.data?.message || "Could not submit claim");
    }
  };

  const handleRefreshSignals = async () => {
    setIsRefreshing(true);
    try {
      await refreshData();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleReviewClaim = async (claimId, decision) => {
    setError("");
    setReviewingClaimId(claimId);

    try {
      const reviewReason =
        decision === "approve"
          ? "Approved via manual review dashboard action."
          : "Rejected via manual review dashboard action.";

      const { data: reviewedClaim } = await claimApi.review(claimId, {
        decision,
        reviewReason
      });

      if (reviewedClaim?.status === "approved") {
        showToast("Claim approved successfully from pending review.");
      } else {
        showToast("Pending claim rejected successfully.");
      }

      await refreshData();
    } catch (apiError) {
      setError(apiError?.response?.data?.message || "Could not review pending claim");
    } finally {
      setReviewingClaimId("");
    }
  };

  const handleParallaxMove = (event) => {
    const shell = shellRef.current;
    if (!shell) {
      return;
    }

    const rect = shell.getBoundingClientRect();
    const px = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    const py = ((event.clientY - rect.top) / rect.height - 0.5) * 2;

    shell.style.setProperty("--mx", px.toFixed(3));
    shell.style.setProperty("--my", py.toFixed(3));
  };

  const resetParallax = () => {
    const shell = shellRef.current;
    if (!shell) {
      return;
    }

    shell.style.setProperty("--mx", "0");
    shell.style.setProperty("--my", "0");
  };

  const stats = useMemo(() => {
    const protectedEarnings = Number(metrics?.worker?.totalProtectedEarnings || 0).toFixed(0);
    const activeCoverage = Number(metrics?.worker?.activeCoverage || 0).toFixed(0);
    const fraudFlags = metrics?.admin?.fraudFlaggedClaims || 0;

    return [
      { label: "Total Protected Earnings", value: `$${protectedEarnings}`, hint: "Approved claims secured" },
      { label: "Weekly Coverage Active", value: `$${activeCoverage}`, hint: "Current active protection" },
      {
        label: "Claims History",
        value: String(metrics?.worker?.totalClaims || claims.length),
        hint: `${metrics?.worker?.approvedClaims || claims.filter((claim) => claim.status === "approved").length} approved`
      },
      {
        label: "Fraud Flags",
        value: String(fraudFlags),
        hint: "GPS, weather mismatch, high-frequency signals"
      }
    ];
  }, [metrics, claims]);

  const workerClaimHistory = metrics?.worker?.claimHistory || [];
  const workerClaimMax = Math.max(...workerClaimHistory.map((entry) => entry.amount), 1);
  const adminWeeklyTrend = metrics?.admin?.weeklyTrend || [];
  const adminWeeklyMax = Math.max(...adminWeeklyTrend.map((entry) => entry.total), 1);
  const gatewayLabelMap = useMemo(
    () =>
      Object.fromEntries(
        (payoutGateways || []).map((gateway) => {
          return [gateway.code, gateway.label];
        })
      ),
    [payoutGateways]
  );

  const analyticsFeed = useMemo(() => {
    const avgPremium =
      activePolicies.length > 0
        ? (
            activePolicies.reduce((sum, policy) => sum + policy.weeklyPremium, 0) / activePolicies.length
          ).toFixed(2)
        : "0.00";

    const approvedClaims = claims.filter((claim) => claim.status === "approved").length;
    const pendingClaims = claims.filter((claim) => claim.status === "pending").length;
    const severeTriggers = (automation?.triggers || []).filter((trigger) =>
      ["high", "critical"].includes(trigger.severity)
    ).length;
    const activeCoverage = activePolicies.reduce((sum, policy) => sum + policy.maxWeeklyCoverage, 0);

    return [
      `LIVE ANALYTICS`,
      `Timestamp ${new Date(now).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
      `${activePolicies.length} active policies online`,
      `$${avgPremium} average weekly premium`,
      `${claims.length} total claims tracked`,
      `${approvedClaims} claims approved`,
      `${pendingClaims} claims pending review`,
      `${severeTriggers} high-risk trigger${severeTriggers === 1 ? "" : "s"} active`,
      `$${activeCoverage} combined active coverage`,
      `${automation?.weather?.condition || "stable"} weather signal`,
      `${automation?.weather?.temperature ?? "--"}C field temperature`,
      `${automation?.weather?.windSpeed ?? "--"} km/h wind profile`
    ];
  }, [activePolicies, claims, automation, now]);

  const weatherSnapshot = useMemo(() => {
    const weather = automation?.weather;
    const conditionRaw = weather?.condition || "unknown";
    const precipitation = Number(weather?.precipitation ?? 0);
    const windSpeed = Number(weather?.windSpeed ?? 0);
    const temperature = Number(weather?.temperature ?? 0);

    const conditionLabel = conditionRaw
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");

    const isCritical = ["violent_rain", "thunderstorm", "hail_storm", "heavy_rain"].includes(conditionRaw) || precipitation > 20;
    const isElevated = precipitation > 10 || windSpeed > 35 || ["rain", "rain_showers", "overcast"].includes(conditionRaw);

    const risk = isCritical ? "critical" : isElevated ? "elevated" : "stable";
    const sourceLabel = weather?.source === "open-meteo" ? "Open-Meteo live feed" : "Fallback model estimate";

    return {
      conditionLabel,
      precipitationLabel: `${precipitation.toFixed(1)} mm`,
      windLabel: `${windSpeed.toFixed(1)} km/h`,
      temperatureLabel: `${temperature.toFixed(1)} C`,
      risk,
      sourceLabel,
      refreshedAt: new Date(now).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    };
  }, [automation?.weather, now]);

  const formatLatency = (startIso, endIso) => {
    if (!startIso || !endIso) {
      return "N/A";
    }

    const start = new Date(startIso).getTime();
    const end = new Date(endIso).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
      return "N/A";
    }

    const seconds = Math.round((end - start) / 1000);
    if (seconds < 60) {
      return `${seconds}s`;
    }

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  return (
    <div className="dashboard-shell" ref={shellRef} onMouseMove={handleParallaxMove} onMouseLeave={resetParallax}>
      {authToast && (
        <div className="toast success" role="status" aria-live="polite">
          <span className="toast-dot" aria-hidden="true" />
          {authToast}
        </div>
      )}
      <header className="topbar glass reveal reveal-1">
        <div>
          <div className="brand-header-row compact">
            <GigShieldLogo className="header-logo" title="Gig Shield" />
            <span className="brand-header-text">Gig Shield</span>
          </div>
          <p className="kicker">Welcome</p>
          <h2 className="welcome-title">Welcome back, {firstName}</h2>
          <p className="subtle">
            {user?.jobType} • {user?.location} • {user?.email}
          </p>
        </div>
        <div className="live-chip">
          <span className="live-chip-title">
            <span className="live-dot" aria-hidden="true" /> Enterprise risk engine active
          </span>
          <span className="live-chip-meta">
            Last sync {lastUpdated ? lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--:--"}
          </span>
        </div>
        <div className="top-actions">
          <button
            className="secondary-btn mode-toggle"
            onClick={toggleTheme}
            aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
            title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
          >
            {theme === "light" ? (
              <svg className="theme-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M21 12.79A9 9 0 1 1 11.21 3c.5 0 .78.58.45.95A7 7 0 0 0 20.05 12c.37-.33.95-.05.95.79Z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <svg className="theme-icon" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.8" />
                <path
                  d="M12 2v2.5M12 19.5V22M4.93 4.93l1.77 1.77M17.3 17.3l1.77 1.77M2 12h2.5M19.5 12H22M4.93 19.07l1.77-1.77M17.3 6.7l1.77-1.77"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>
          <button className="secondary-btn" onClick={handleRefreshSignals} disabled={isRefreshing}>
            {isRefreshing ? "Refreshing..." : "Refresh Signals"}
          </button>
          <button className="text-btn" onClick={logout}>
            Logout
          </button>
        </div>
      </header>

      <section className="analytics-ribbon glass reveal reveal-2" aria-label="Live analytics ribbon">
        <div className="analytics-track">
          {[...analyticsFeed, ...analyticsFeed].map((item, index) => (
            <span key={`${item}-${index}`} className="analytics-pill">
              {item}
            </span>
          ))}
        </div>
      </section>

      {error && <p className="error banner">{error}</p>}
      {loading && <p className="subtle">Loading dashboard...</p>}

      <section className="stats-grid reveal reveal-3">
        {stats.map((item) => (
          <StatCard key={item.label} {...item} />
        ))}
      </section>

      <section className="grid-two reveal reveal-4">
        <div className="panel glass">
          <p className="section-tag">Policy Portfolio</p>
          <h3>Available Policies</h3>
          <div className="list-wrap">
            {catalog.map((policy) => (
              <article key={policy.id} className="list-card">
                <div>
                  <h4>{policy.name}</h4>
                  <p>{policy.description}</p>
                  <p className="mini">Coverage up to ${policy.maxWeeklyCoverage}/week</p>
                  <p className="mini">
                    Dynamic Premium = {policy.dynamicPremium?.breakdown?.formula} =
                    <strong> ${policy.dynamicPremium?.weeklyPremium}</strong>
                  </p>
                  <p className="mini">
                    Factors: Job {policy.dynamicPremium?.breakdown?.jobRisk} | Location {policy.dynamicPremium?.breakdown?.locationRisk} |
                    Weather {policy.dynamicPremium?.breakdown?.weatherRisk}
                  </p>
                </div>
                <button className="primary-btn" onClick={() => buyPolicy(policy.id)}>
                  Purchase Policy
                </button>
              </article>
            ))}
          </div>
        </div>

        <div className="panel glass">
          <p className="section-tag">Risk Intelligence</p>
          <h3>Automation Triggers & Notifications</h3>
          <div className="list-wrap">
            {(automation?.triggers || []).map((trigger) => (
              <article key={trigger.code} className="list-card compact">
                <h4>{trigger.label}</h4>
                <p>{trigger.impact}</p>
                <span className={`badge ${trigger.severity}`}>{trigger.severity}</span>
              </article>
            ))}
          </div>
          <div className="weather-box">
            <div className="weather-head">
              <h4>Live Weather Intelligence</h4>
              <span className={`weather-risk ${weatherSnapshot.risk}`}>{weatherSnapshot.risk}</span>
            </div>
            <p className="weather-meta">
              {weatherSnapshot.sourceLabel} • refreshed {weatherSnapshot.refreshedAt}
            </p>
            <div className="weather-grid">
              <article className="weather-stat">
                <p className="weather-label">Condition</p>
                <p className="weather-value">{weatherSnapshot.conditionLabel}</p>
              </article>
              <article className="weather-stat">
                <p className="weather-label">Temperature</p>
                <p className="weather-value">{weatherSnapshot.temperatureLabel}</p>
              </article>
              <article className="weather-stat">
                <p className="weather-label">Precipitation</p>
                <p className="weather-value">{weatherSnapshot.precipitationLabel}</p>
              </article>
              <article className="weather-stat">
                <p className="weather-label">Wind Profile</p>
                <p className="weather-value">{weatherSnapshot.windLabel}</p>
              </article>
            </div>
          </div>

          <div className="list-wrap">
            <h4>Automated Policy Adjustments</h4>
            {(automation?.policyAdjustments || []).length === 0 && (
              <p className="subtle">No active policy adjustments yet.</p>
            )}
            {(automation?.policyAdjustments || []).map((adjustment) => (
              <article key={adjustment.policyId} className="list-card compact">
                <h4>{adjustment.policyName}</h4>
                <p>
                  Coverage: ${adjustment.previousCoverageCap} to ${adjustment.adjustedCoverageCap}
                </p>
                <p>
                  Premium: ${adjustment.previousPremium} to ${adjustment.adjustedPremium}
                </p>
                <p className="mini">{adjustment.reasons.join(" ")}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="grid-two reveal reveal-5">
        <div className="panel glass">
          <p className="section-tag">Coverage Overview</p>
          <h3>Active Coverage</h3>
          <div className="list-wrap">
            {activePolicies.length === 0 && <p className="subtle">No active policy yet. Purchase one above.</p>}
            {activePolicies.map((policy) => (
              <article key={policy.id} className="list-card compact">
                <h4>{policy.policyName}</h4>
                <p>Weekly Premium: ${policy.weeklyPremium}</p>
                <p>Coverage Cap: ${policy.maxWeeklyCoverage}</p>
                <p className="mini">Status: {policy.status}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="panel glass">
          <p className="section-tag">Claims Operations</p>
          <h3>Raise Manual Claim</h3>
          <form className="form-grid" onSubmit={submitClaim}>
            <select
              value={manualClaim.policyId}
              onChange={(event) => setManualClaim((prev) => ({ ...prev, policyId: event.target.value }))}
              required
            >
              <option value="">Select active policy</option>
              {activePolicies.map((policy) => (
                <option key={policy.id} value={policy.id}>
                  {policy.policyName}
                </option>
              ))}
            </select>
            <select
              value={manualClaim.claimType}
              onChange={(event) => setManualClaim((prev) => ({ ...prev, claimType: event.target.value }))}
            >
              <option value="weather_disruption">Weather disruption</option>
              <option value="traffic_disruption">Traffic disruption</option>
              <option value="medical_support">Medical support</option>
            </select>
            <input
              placeholder="Claim description"
              value={manualClaim.description}
              onChange={(event) => setManualClaim((prev) => ({ ...prev, description: event.target.value }))}
              required
            />
            <input
              type="number"
              min="1"
              value={manualClaim.amount}
              onChange={(event) => setManualClaim((prev) => ({ ...prev, amount: event.target.value }))}
              required
            />
            <select
              value={manualClaim.payoutGateway}
              onChange={(event) => setManualClaim((prev) => ({ ...prev, payoutGateway: event.target.value }))}
            >
              {(payoutGateways || []).map((gateway) => (
                <option key={gateway.code} value={gateway.code}>
                  {gateway.label}
                </option>
              ))}
            </select>
            <input
              placeholder="Claimed weather (example: heavy_rain)"
              value={manualClaim.claimedWeather}
              onChange={(event) => setManualClaim((prev) => ({ ...prev, claimedWeather: event.target.value }))}
            />
            <input
              type="number"
              step="any"
              placeholder="Reported lat"
              value={manualClaim.reportedLocationLat}
              onChange={(event) => setManualClaim((prev) => ({ ...prev, reportedLocationLat: event.target.value }))}
            />
            <input
              type="number"
              step="any"
              placeholder="Reported lon"
              value={manualClaim.reportedLocationLon}
              onChange={(event) => setManualClaim((prev) => ({ ...prev, reportedLocationLon: event.target.value }))}
            />
            <input
              type="number"
              step="any"
              placeholder="Delivery route lat"
              value={manualClaim.deliveryLocationLat}
              onChange={(event) => setManualClaim((prev) => ({ ...prev, deliveryLocationLat: event.target.value }))}
            />
            <input
              type="number"
              step="any"
              placeholder="Delivery route lon"
              value={manualClaim.deliveryLocationLon}
              onChange={(event) => setManualClaim((prev) => ({ ...prev, deliveryLocationLon: event.target.value }))}
            />
            <button className="primary-btn" type="submit">
              Submit Claim
            </button>
          </form>

          <h4>Claims History</h4>
          <div className="list-wrap">
            {claims.length === 0 && <p className="subtle">No claims yet.</p>}
            {claims.map((claim) => (
              <article key={claim.id} className="list-card compact">
                {(() => {
                  const checks = claim?.fraudAssessment?.checks || {};
                  const signalTags = [];
                  if (checks.gpsMismatch) {
                    signalTags.push("GPS");
                  }
                  if (checks.weatherMismatch) {
                    signalTags.push("WEATHER");
                  }
                  if (checks.frequentClaims) {
                    signalTags.push("FREQUENCY");
                  }

                  const score = Number(claim?.fraudAssessment?.fraudScore || 0);
                  const confidence = score >= 70 ? "HIGH" : score >= 45 ? "MEDIUM" : "LOW";
                  const decisionEnd = claim.reviewedAt || claim.payoutProcessedAt || claim.updatedAt || null;
                  const decisionLatency = claim.status === "pending" ? "Awaiting review" : formatLatency(claim.createdAt, decisionEnd);

                  return (
                    <div className="claim-summary-row">
                      <span className="claim-summary-chip">Signals: {signalTags.length > 0 ? signalTags.join(" + ") : "None"}</span>
                      <span className="claim-summary-chip">Decision Latency: {decisionLatency}</span>
                      <span className="claim-summary-chip">Confidence: {confidence}</span>
                    </div>
                  );
                })()}
                <h4>{claim.claimType}</h4>
                <p>{claim.description}</p>
                <p>Amount: ${claim.amount}</p>
                <p>
                  Status: <span className={`badge ${claim.status}`}>{claim.status}</span>
                </p>
                <p>
                  Payout: <span className={`badge ${claim.payoutStatus || "not_started"}`}>{claim.payoutStatus || "not_started"}</span>
                </p>
                <p className="mini">Gateway: {gatewayLabelMap[claim.payoutGateway] || claim.payoutGateway || "N/A"}</p>
                {claim?.fraudAssessment?.riskLevel && (
                  <p>
                    Fraud Risk: <span className={`badge ${claim.fraudAssessment.riskLevel}`}>{claim.fraudAssessment.riskLevel}</span> (
                    {claim.fraudAssessment.fraudScore}/100)
                  </p>
                )}
                {claim.status === "pending" && (
                  <div className="claim-review-actions">
                    <button
                      className="secondary-btn tiny-btn"
                      type="button"
                      disabled={reviewingClaimId === claim.id}
                      onClick={() => handleReviewClaim(claim.id, "approve")}
                    >
                      {reviewingClaimId === claim.id ? "Reviewing..." : "Approve"}
                    </button>
                    <button
                      className="text-btn tiny-btn"
                      type="button"
                      disabled={reviewingClaimId === claim.id}
                      onClick={() => handleReviewClaim(claim.id, "reject")}
                    >
                      Reject
                    </button>
                  </div>
                )}
                <p className="mini">{claim.decisionReason}</p>
                {claim.payoutMessage && <p className="mini">{claim.payoutMessage}</p>}
                {claim.payoutTransactionId && <p className="mini">Transaction: {claim.payoutTransactionId}</p>}
                {(claim.timeline || []).length > 0 && (
                  <div className="claim-timeline">
                    <p className="mini timeline-title">Explainable Timeline</p>
                    {(claim.timeline || []).slice(-6).map((event) => (
                      <div key={event.id} className="timeline-row">
                        <span className="timeline-dot" aria-hidden="true" />
                        <div>
                          <p className="timeline-heading">{event.title}</p>
                          <p className="mini">{event.detail}</p>
                          <p className="timeline-time">{new Date(event.at).toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="grid-two reveal reveal-5">
        <div className="panel glass">
          <p className="section-tag">Worker Dashboard</p>
          <h3>Coverage and Earnings Intelligence</h3>
          <div className="metrics-inline">
            <article className="metric-tile">
              <p className="metric-label">Earnings Protected</p>
              <p className="metric-value">${Number(metrics?.worker?.totalProtectedEarnings || 0).toFixed(0)}</p>
            </article>
            <article className="metric-tile">
              <p className="metric-label">Weekly Coverage</p>
              <p className="metric-value">${Number(metrics?.worker?.activeCoverage || 0).toFixed(0)}</p>
            </article>
            <article className="metric-tile">
              <p className="metric-label">Approval Ratio</p>
              <p className="metric-value">
                {metrics?.worker?.totalClaims
                  ? `${Math.round(((metrics?.worker?.approvedClaims || 0) / metrics.worker.totalClaims) * 100)}%`
                  : "0%"}
              </p>
            </article>
          </div>
          <div className="mini-chart">
            <h4>Earnings Over Recent Claims</h4>
            {workerClaimHistory.length === 0 && <p className="subtle">No claims yet for worker trend graph.</p>}
            {workerClaimHistory.map((entry) => (
              <div className="bar-row" key={entry.label}>
                <span className="bar-label">{entry.label}</span>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${Math.max((entry.amount / workerClaimMax) * 100, 6)}%` }} />
                </div>
                <span className="bar-value">${entry.amount}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="panel glass">
          <p className="section-tag">Admin Dashboard</p>
          <h3>Loss, Fraud and Prediction Signals</h3>
          <div className="metrics-inline">
            <article className="metric-tile">
              <p className="metric-label">Loss Ratio</p>
              <p className="metric-value">{Number(metrics?.admin?.lossRatio || 0).toFixed(2)}</p>
            </article>
            <article className="metric-tile">
              <p className="metric-label">Fraud Detected</p>
              <p className="metric-value">{metrics?.admin?.fraudFlaggedClaims || 0}</p>
            </article>
            <article className="metric-tile">
              <p className="metric-label">Expected Next Week</p>
              <p className="metric-value">{metrics?.admin?.predictedClaimsNextWeek || 0}</p>
            </article>
          </div>
          <div className="mini-chart">
            <h4>Claims Trend Heat Bars</h4>
            {adminWeeklyTrend.length === 0 && <p className="subtle">Trend model is warming up.</p>}
            {adminWeeklyTrend.map((entry) => (
              <div className="bar-row" key={entry.weekLabel}>
                <span className="bar-label">{entry.weekLabel}</span>
                <div className="bar-track">
                  <div className="bar-fill risk" style={{ width: `${Math.max((entry.total / adminWeeklyMax) * 100, 6)}%` }} />
                </div>
                <span className="bar-value">{entry.total}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="app-footer">Developed by @TeamException</footer>
    </div>
  );
}
