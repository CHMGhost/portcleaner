document.addEventListener('DOMContentLoaded', function() {
    const navToggle = document.querySelector('.nav-toggle');
    const navMenu = document.querySelector('.nav-menu');
    const navLinks = document.querySelectorAll('.nav-menu a');
    
    navToggle.addEventListener('click', function() {
        navMenu.classList.toggle('active');
        navToggle.classList.toggle('active');
    });
    
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            const targetSection = document.querySelector(targetId);
            
            if (targetSection) {
                const offset = 80;
                const targetPosition = targetSection.offsetTop - offset;
                
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
                
                navMenu.classList.remove('active');
                navToggle.classList.remove('active');
            }
        });
    });
    
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '-100px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('fade-in');
                
                if (entry.target.classList.contains('stat-card')) {
                    animateStatNumber(entry.target);
                }
            }
        });
    }, observerOptions);
    
    document.querySelectorAll('.stat-card, .skill-category, .timeline-item, .project-card').forEach(el => {
        observer.observe(el);
    });
    
    function animateStatNumber(card) {
        const numberElement = card.querySelector('.stat-number');
        const targetText = numberElement.textContent;
        
        if (targetText.includes('%')) {
            const target = parseInt(targetText);
            animateValue(numberElement, 0, target, 1000, '%');
        } else if (targetText.includes('ms')) {
            const target = parseInt(targetText.replace(/\D/g, ''));
            animateValue(numberElement, 0, target, 1000, 'ms');
        }
    }
    
    function animateValue(element, start, end, duration, suffix = '') {
        const range = end - start;
        const increment = range / (duration / 16);
        let current = start;
        
        const timer = setInterval(() => {
            current += increment;
            if ((increment > 0 && current >= end) || (increment < 0 && current <= end)) {
                element.textContent = `${end}${suffix}`;
                clearInterval(timer);
            } else {
                element.textContent = `${Math.floor(current)}${suffix}`;
            }
        }, 16);
    }
    
    const sections = document.querySelectorAll('section[id]');
    const navItems = document.querySelectorAll('.nav-menu a');
    
    window.addEventListener('scroll', () => {
        let current = '';
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.clientHeight;
            if (scrollY >= (sectionTop - 200)) {
                current = section.getAttribute('id');
            }
        });
        
        navItems.forEach(item => {
            item.classList.remove('active');
            if (item.getAttribute('href').substring(1) === current) {
                item.classList.add('active');
            }
        });
    });
    
    const terminalLines = document.querySelectorAll('.terminal-line');
    terminalLines.forEach((line, index) => {
        line.style.opacity = '0';
        line.style.animation = `fadeIn 0.5s ${index * 0.3}s forwards`;
    });
    
    window.addEventListener('scroll', () => {
        const navbar = document.querySelector('.navbar');
        if (window.scrollY > 50) {
            navbar.style.background = 'rgba(15, 23, 42, 0.98)';
        } else {
            navbar.style.background = 'rgba(15, 23, 42, 0.95)';
        }
    });
    
    const projectCards = document.querySelectorAll('.project-card');
    projectCards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-10px) scale(1.02)';
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0) scale(1)';
        });
    });
    
    const skillTags = document.querySelectorAll('.skill-tag');
    skillTags.forEach(tag => {
        tag.addEventListener('mouseenter', function() {
            const randomColor = `hsl(${Math.random() * 60 + 180}, 70%, 50%)`;
            this.style.borderColor = randomColor;
            this.style.color = randomColor;
        });
        
        tag.addEventListener('mouseleave', function() {
            this.style.borderColor = '';
            this.style.color = '';
        });
    });
});

const style = document.createElement('style');
style.textContent = `
    @keyframes fadeIn {
        from {
            opacity: 0;
            transform: translateY(20px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
    
    .fade-in {
        animation: fadeIn 0.6s ease-out;
    }
    
    .nav-menu.active {
        display: flex;
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        flex-direction: column;
        background: rgba(15, 23, 42, 0.98);
        padding: 1rem 2rem;
        border-bottom: 1px solid var(--border-color);
    }
    
    .nav-toggle.active span:nth-child(1) {
        transform: rotate(-45deg) translate(-5px, 6px);
    }
    
    .nav-toggle.active span:nth-child(2) {
        opacity: 0;
    }
    
    .nav-toggle.active span:nth-child(3) {
        transform: rotate(45deg) translate(-5px, -6px);
    }
    
    .nav-menu a.active {
        color: var(--primary-color);
        position: relative;
    }
    
    .nav-menu a.active::after {
        content: '';
        position: absolute;
        bottom: -5px;
        left: 0;
        right: 0;
        height: 2px;
        background: var(--primary-color);
    }
`;
document.head.appendChild(style);