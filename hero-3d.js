/* ==========================================================================
   PV predictive maintenance - Hero 3D WebGL Background & GSAP animations
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // ==========================================================================
    // 1. GSAP ENTRANCE ANIMATIONS
    // ==========================================================================
    if (typeof gsap !== 'undefined') {
        const tl = gsap.timeline({ defaults: { ease: 'power4.out', duration: 1.2 } });

        // Set initial visibility overrides to prevent FOUC (flash of uncontented content)
        gsap.set('.badge-container, .hero-title, .hero-subtitle, .hero-ctas, .scroll-indicator', { opacity: 0 });

        tl.fromTo('.badge-container', 
            { y: -30, opacity: 0 }, 
            { y: 0, opacity: 1, delay: 0.2 }
        )
        .fromTo('.hero-title', 
            { y: 50, scale: 0.98, opacity: 0 }, 
            { y: 0, scale: 1, opacity: 1, duration: 1.4 }, 
            '-=0.9'
        )
        .fromTo('.hero-subtitle', 
            { y: 30, opacity: 0 }, 
            { y: 0, opacity: 1 }, 
            '-=1.0'
        )
        .fromTo('.hero-ctas .btn', 
            { y: 20, opacity: 0 }, 
            { y: 0, opacity: 1, stagger: 0.15, duration: 1.0 }, 
            '-=0.8'
        )
        .fromTo('.scroll-indicator', 
            { y: 15, opacity: 0 }, 
            { y: 0, opacity: 1, duration: 1.5 }, 
            '-=0.5'
        );
    }

    // ==========================================================================
    // 2. THREE.JS 3D BACKGROUND SCENE
    // ==========================================================================
    const container = document.getElementById('hero-3d-canvas-container');
    if (!container || typeof THREE === 'undefined') return;

    // Scene Setup
    const scene = new THREE.Scene();

    // Camera Setup
    const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.set(0, 0, 15);

    // Renderer Setup
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // Lighting (Subtle futuristic ambient + directional accent)
    const ambientLight = new THREE.AmbientLight(0x0e172a, 1.5);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0x38bdf8, 2.5);
    dirLight.position.set(5, 10, 7);
    scene.add(dirLight);

    const pointLight = new THREE.PointLight(0x3b82f6, 3, 30);
    pointLight.position.set(-5, -5, 5);
    scene.add(pointLight);

    // Build the Solar PV Array Digital Twin
    const pvGroup = new THREE.Group();

    // Geometry of individual panels (width, height, thickness)
    const panelWidth = 2.0;
    const panelHeight = 3.2;
    const panelDepth = 0.06;
    const panelGeometry = new THREE.BoxGeometry(panelWidth, panelHeight, panelDepth);

    // Deep blue face representing the monocrystalline PV laminates
    const faceMaterial = new THREE.MeshBasicMaterial({
        color: 0x070b19,
        transparent: true,
        opacity: 0.65,
        side: THREE.DoubleSide
    });

    // Glowing cyan edges mapping physical PV panel edges
    const edgesGeometry = new THREE.EdgesGeometry(panelGeometry);
    const lineMaterial = new THREE.LineBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.5
    });

    // Grid of solar arrays (e.g. 4 rows, 4 columns)
    const rows = 4;
    const cols = 4;
    const colSpacing = 2.6;
    const rowSpacing = 3.8;

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const panelMesh = new THREE.Mesh(panelGeometry, faceMaterial);
            const wireframe = new THREE.LineSegments(edgesGeometry, lineMaterial);
            panelMesh.add(wireframe);

            // Center the grid around coordinates (0, 0)
            const posX = (c - (cols - 1) / 2) * colSpacing;
            const posZ = (r - (rows - 1) / 2) * rowSpacing;

            panelMesh.position.set(posX, 0, posZ);
            
            // Subtle random starting orientation for natural layout
            panelMesh.rotation.z = (Math.random() - 0.5) * 0.02;

            pvGroup.add(panelMesh);
        }
    }

    // Default tilt matching standard PV tracking configurations (tilted back)
    pvGroup.rotation.x = -Math.PI / 4.5;
    pvGroup.rotation.y = Math.PI / 6;
    scene.add(pvGroup);

    // Photon Particle Field (Constellation representing solar radiation)
    const particleCount = 250;
    const particleGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const particleVelocities = [];

    for (let i = 0; i < particleCount * 3; i += 3) {
        // Distribute particles across a wide 3D boundary box
        positions[i] = (Math.random() - 0.5) * 35;
        positions[i + 1] = (Math.random() - 0.5) * 20;
        positions[i + 2] = (Math.random() - 0.5) * 25;

        // Custom velocity profiles (slowly floating up towards the sun)
        particleVelocities.push({
            x: (Math.random() - 0.5) * 0.015,
            y: Math.random() * 0.012 + 0.008,
            z: (Math.random() - 0.5) * 0.015
        });
    }

    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    // Particle Material (Soft glowing cyan points)
    const pointsMaterial = new THREE.PointsMaterial({
        size: 0.12,
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });

    const particleSystem = new THREE.Points(particleGeometry, pointsMaterial);
    scene.add(particleSystem);

    // Track Mouse Coordinates for Interactive Parallax
    let mouseX = 0;
    let mouseY = 0;
    let targetCameraX = 0;
    let targetCameraY = 0;

    window.addEventListener('mousemove', (event) => {
        // Map mouse coordinates to [-1, 1] range
        mouseX = (event.clientX / window.innerWidth) * 2 - 1;
        mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
    });

    // Handle Window Resizing
    window.addEventListener('resize', () => {
        const width = container.clientWidth;
        const height = container.clientHeight;

        camera.aspect = width / height;
        camera.updateProjectionMatrix();

        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    });

    // Animation Loop
    const clock = new THREE.Clock();
    
    function animate() {
        requestAnimationFrame(animate);

        const elapsedTime = clock.getElapsedTime();

        // 1. Slow automatic rotation of the entire solar array group
        pvGroup.rotation.y = Math.PI / 6 + Math.sin(elapsedTime * 0.08) * 0.15;
        
        // 2. Waving track oscillation (simulating wind stress or tracking sweeps)
        pvGroup.children.forEach((panel, idx) => {
            // Wavy motion on individual panels using sine math
            panel.position.y = Math.sin(elapsedTime + idx * 0.4) * 0.08;
            panel.rotation.x = Math.sin(elapsedTime * 0.5 + idx) * 0.03;
        });

        // 3. Photon particles stream update
        const positionsArr = particleGeometry.attributes.position.array;
        for (let i = 0; i < particleCount; i++) {
            const idx = i * 3;
            positionsArr[idx] += particleVelocities[i].x;
            positionsArr[idx + 1] += particleVelocities[i].y;
            positionsArr[idx + 2] += particleVelocities[i].z;

            // Boundary checks: Reset particles to bottom when they float out of range
            if (positionsArr[idx + 1] > 12) {
                positionsArr[idx + 1] = -12;
                positionsArr[idx] = (Math.random() - 0.5) * 35;
                positionsArr[idx + 2] = (Math.random() - 0.5) * 25;
            }
        }
        particleGeometry.attributes.position.needsUpdate = true;

        // 4. Smooth camera parallax interpolation (ease towards target mouse coordinates)
        targetCameraX = mouseX * 2.5;
        targetCameraY = mouseY * 2.0;

        camera.position.x += (targetCameraX - camera.position.x) * 0.05;
        camera.position.y += (targetCameraY - camera.position.y) * 0.05;
        camera.lookAt(new THREE.Vector3(0, 0, 0));

        // Render the scene
        renderer.render(scene, camera);
    }

    animate();
});
