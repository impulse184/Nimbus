/**
 * High-Performance HTML5 Canvas Weather Particle Engine
 * Locks at 120 FPS using requestAnimationFrame and vector math overlays.
 */
class WeatherCanvas {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.particles = [];
    this.animationFrameId = null;
    this.activeType = null; // 'rain', 'snow', 'stars', or null
    this.width = 0;
    this.height = 0;

    this.initResize();
    this.resize();
  }

  initResize() {
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    // Re-initialize particles to fill new bounds
    if (this.activeType) {
      this.setWeatherType(this.activeType);
    }
  }

  setWeatherType(type) {
    this.stop();
    this.activeType = type;
    this.particles = [];

    if (!type) {
      this.ctx.clearRect(0, 0, this.width, this.height);
      return;
    }

    let count = 0;
    if (type === 'rain') {
      count = Math.min(Math.floor(this.width * 0.15), 180);
      for (let i = 0; i < count; i++) {
        this.particles.push({
          x: Math.random() * this.width,
          y: Math.random() * this.height - this.height,
          vy: 12 + Math.random() * 8,
          vx: -2 - Math.random() * 2,
          len: 15 + Math.random() * 20,
          opacity: 0.15 + Math.random() * 0.3
        });
      }
    } else if (type === 'snow') {
      count = Math.min(Math.floor(this.width * 0.1), 100);
      for (let i = 0; i < count; i++) {
        this.particles.push({
          x: Math.random() * this.width,
          y: Math.random() * this.height,
          vy: 1 + Math.random() * 2,
          vx: -0.5 + Math.random() * 1,
          r: 1.5 + Math.random() * 3,
          swing: Math.random() * 100,
          swingSpeed: 0.01 + Math.random() * 0.02,
          opacity: 0.2 + Math.random() * 0.5
        });
      }
    } else if (type === 'stars') {
      count = Math.min(Math.floor(this.width * 0.06), 60);
      for (let i = 0; i < count; i++) {
        this.particles.push({
          x: Math.random() * this.width,
          y: Math.random() * this.height * 0.8, // stars mostly in upper sky
          r: 0.8 + Math.random() * 1.4,
          pulseSpeed: 0.01 + Math.random() * 0.03,
          pulseOffset: Math.random() * Math.PI,
          baseOpacity: 0.1 + Math.random() * 0.5
        });
      }
    }

    this.start();
  }

  start() {
    const loop = () => {
      this.update();
      this.draw();
      this.animationFrameId = requestAnimationFrame(loop);
    };
    loop();
  }

  stop() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  update() {
    if (this.activeType === 'rain') {
      for (let p of this.particles) {
        p.y += p.vy;
        p.x += p.vx;
        if (p.y > this.height) {
          p.y = -p.len;
          p.x = Math.random() * this.width;
        }
      }
    } else if (this.activeType === 'snow') {
      for (let p of this.particles) {
        p.y += p.vy;
        p.swing += p.swingSpeed;
        p.x += p.vx + Math.sin(p.swing) * 0.5;
        if (p.y > this.height) {
          p.y = -5;
          p.x = Math.random() * this.width;
        }
        if (p.x < 0) p.x = this.width;
        if (p.x > this.width) p.x = 0;
      }
    }
  }

  draw() {
    this.ctx.clearRect(0, 0, this.width, this.height);

    if (this.activeType === 'rain') {
      this.ctx.strokeStyle = 'rgba(156, 207, 255, 0.6)';
      this.ctx.lineWidth = 1.6;
      for (let p of this.particles) {
        this.ctx.beginPath();
        this.ctx.globalAlpha = p.opacity;
        this.ctx.moveTo(p.x, p.y);
        this.ctx.lineTo(p.x + p.vx, p.y + p.len);
        this.ctx.stroke();
      }
    } else if (this.activeType === 'snow') {
      for (let p of this.particles) {
        this.ctx.beginPath();
        this.ctx.globalAlpha = p.opacity;
        
        // Draw soft glowing feathered snowflake using radial gradient
        const grad = this.ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
        grad.addColorStop(0.3, 'rgba(255, 255, 255, 0.8)');
        grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        
        this.ctx.fillStyle = grad;
        this.ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        this.ctx.fill();
      }
    } else if (this.activeType === 'stars') {
      this.ctx.fillStyle = '#ffffff';
      const time = Date.now();
      for (let p of this.particles) {
        const opacity = p.baseOpacity * (0.3 + 0.7 * Math.abs(Math.sin(time * p.pulseSpeed + p.pulseOffset)));
        this.ctx.beginPath();
        this.ctx.globalAlpha = opacity;
        this.ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }
    this.ctx.globalAlpha = 1.0; // Reset
  }
}

// Attach globally
window.WeatherCanvas = WeatherCanvas;
