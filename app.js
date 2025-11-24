// app.js

(() => {
  const audienceSelect = document.getElementById("audience-select");
  const specialSelect = document.getElementById("special-select");
  const goButton = document.getElementById("go-button");
  const statusEl = document.getElementById("status");

  const canvas = document.getElementById("xr-canvas");
  const video = document.getElementById("xr-video");

  let renderer = null;
  let scene = null;
  let camera = null;
  let sphere = null;
  let xrSession = null;
  let initializedThree = false;

  function setStatus(message) {
    statusEl.textContent = message || "";
  }

  function clearStatus() {
    statusEl.textContent = "";
  }

  // Ensure only one dropdown is active at a time
  audienceSelect.addEventListener("change", () => {
    if (audienceSelect.value) {
      specialSelect.value = "";
    }
    clearStatus();
  });

  specialSelect.addEventListener("change", () => {
    if (specialSelect.value) {
      audienceSelect.value = "";
    }
    clearStatus();
  });

  function getSelectedVideoUrl() {
    const a = audienceSelect.value;
    const s = specialSelect.value;
    if (a && s) {
      // Shouldn't happen due to clearing logic, but guard just in case
      return null;
    }
    return a || s || null;
  }

  // Initialize Three.js scene used for VR
  function initThreeIfNeeded() {
    if (initializedThree) return;

    renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      alpha: false,
    });
    renderer.xr.enabled = true;
    renderer.outputEncoding = THREE.sRGBEncoding;

    scene = new THREE.Scene();

    // Simple camera; in VR the pose is controlled by WebXR
    camera = new THREE.PerspectiveCamera(70, 1, 0.1, 1000);
    scene.add(camera);

    // 360 sphere with video texture
    const geometry = new THREE.SphereGeometry(10, 64, 64);
    geometry.scale(-1, 1, 1); // face inward

    const videoTexture = new THREE.VideoTexture(video);
    videoTexture.minFilter = THREE.LinearFilter;
    videoTexture.magFilter = THREE.LinearFilter;
    videoTexture.format = THREE.RGBFormat;

    const material = new THREE.MeshBasicMaterial({ map: videoTexture });

    sphere = new THREE.Mesh(geometry, material);
    scene.add(sphere);

    renderer.setAnimationLoop(() => {
      renderer.render(scene, camera);
    });

    initializedThree = true;
  }

  async function ensureWebXRSupport() {
    if (!("xr" in navigator)) {
      throw new Error(
        "WebXR is not available in this browser. Please use a WebXR-compatible browser (e.g. WebXR Viewer on iOS, Quest Browser, or Chrome with WebXR)."
      );
    }

    let supported = false;
    try {
      supported = await navigator.xr.isSessionSupported("immersive-vr");
    } catch (err) {
      console.error("Error checking XR session support:", err);
      supported = false;
    }

    if (!supported) {
      throw new Error(
        "Immersive VR sessions are not supported on this device or browser."
      );
    }
  }

  async function startVideo(url) {
    video.src = url;
    video.loop = true;
    video.muted = false; // you asked for audio by default
    video.crossOrigin = "anonymous";

    try {
      // load() then play() in response to the Go click (user gesture)
      video.load();
      await video.play();
    } catch (err) {
      console.error("Failed to start video playback:", err);
      throw new Error(
        "Failed to start 360° video playback. Your browser may be blocking autoplay with audio."
      );
    }
  }

  async function startXRSession() {
    const sessionInit = {
      requiredFeatures: ["local-floor"],
      optionalFeatures: [],
    };

    let session;
    try {
      session = await navigator.xr.requestSession("immersive-vr", sessionInit);
    } catch (err) {
      console.error("Failed to start XR session:", err);
      throw new Error("Failed to start immersive VR session.");
    }

    xrSession = session;

    session.addEventListener("end", () => {
      xrSession = null;
      // Stop video when exiting VR
      if (!video.paused) {
        video.pause();
      }
      setStatus("VR session ended. Select another simulation to enter again.");
      goButton.disabled = false;
    });

    renderer.xr.setSession(session);
  }

  async function handleGoClick() {
    clearStatus();

    const url = getSelectedVideoUrl();
    if (!url) {
      setStatus("Please select one simulation before entering VR.");
      return;
    }

    goButton.disabled = true;
    setStatus("Checking VR support...");

    try {
      // Enforce VR-or-nothing: if this fails, we do NOT play in non-VR.
      await ensureWebXRSupport();

      setStatus("Preparing 360° video...");
      await startVideo(url);

      initThreeIfNeeded();

      setStatus("Starting VR session...");
      await startXRSession();

      // Once VR starts, status text is mainly for after exit
      clearStatus();
    } catch (err) {
      console.error(err);
      setStatus(err.message || "An error occurred.");
      goButton.disabled = false;
    }
  }

  goButton.addEventListener("click", () => {
    // If there's an existing session, end it before starting a new one
    if (xrSession) {
      xrSession.end().finally(handleGoClick);
    } else {
      handleGoClick();
    }
  });
})();
