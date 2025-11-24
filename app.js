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

  function getSelectedVideoUrl() {
    const a = audienceSelect.value;
    const s = specialSelect.value;
    if (a && s) return null;
    return a || s || null;
  }

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

  function initThreeIfNeeded() {
    if (initializedThree) return;

    renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
    });
    renderer.xr.enabled = true;

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(70, 1, 0.1, 1000);
    scene.add(camera);

    const geometry = new THREE.SphereGeometry(10, 64, 64);
    geometry.scale(-1, 1, 1);

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
        "WebXR not supported. Use WebXR Viewer (iOS), Android Chrome, or Quest Browser."
      );
    }

    const supported = await navigator.xr.isSessionSupported("immersive-vr");
    if (!supported) {
      throw new Error("Immersive VR not supported on this device.");
    }
  }

  async function startVideo(url) {
    video.src = url;
    video.loop = true;
    video.muted = false;
    video.crossOrigin = "anonymous";

    try {
      video.load();
      await video.play();
    } catch (err) {
      throw new Error(
        "Unable to autoplay 360° video with audio. Browser restricted it."
      );
    }
  }

  async function startXRSession() {
    const session = await navigator.xr.requestSession("immersive-vr", {
      requiredFeatures: ["local-floor"],
    });

    xrSession = session;

    session.addEventListener("end", () => {
      xrSession = null;
      video.pause();
      setStatus("VR session ended. Select another simulation.");
      goButton.disabled = false;
    });

    renderer.xr.setSession(session);
  }

  async function handleGo() {
    clearStatus();

    const url = getSelectedVideoUrl();
    if (!url) {
      setStatus("Please select one simulation.");
      return;
    }

    goButton.disabled = true;
    setStatus("Checking VR support...");

    try {
      await ensureWebXRSupport();

      setStatus("Starting video...");
      await startVideo(url);

      initThreeIfNeeded();

      setStatus("Entering VR...");
      await startXRSession();

      clearStatus();
    } catch (err) {
      setStatus(err.message);
      goButton.disabled = false;
    }
  }

  goButton.addEventListener("click", () => {
    if (xrSession) {
      xrSession.end().finally(handleGo);
    } else {
      handleGo();
    }
  });
})();
