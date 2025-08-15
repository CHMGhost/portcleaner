// Shopping Cart Management
let cart = [];

// Mobile Navigation Toggle with ARIA
const hamburger = document.querySelector('.hamburger');
const navMenu = document.querySelector('.nav-menu');

hamburger.addEventListener('click', () => {
    const isExpanded = hamburger.getAttribute('aria-expanded') === 'true';
    hamburger.setAttribute('aria-expanded', !isExpanded);
    navMenu.classList.toggle('active');
    
    // Focus management
    if (!isExpanded) {
        navMenu.querySelector('.nav-link').focus();
    }
});

// Close mobile menu with Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && navMenu.classList.contains('active')) {
        navMenu.classList.remove('active');
        hamburger.setAttribute('aria-expanded', 'false');
        hamburger.focus();
    }
});

// Smooth Scrolling for Navigation Links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
            navMenu.classList.remove('active');
        }
    });
});

// Product Filter Functionality with Empty State
const filterButtons = document.querySelectorAll('.filter-btn');
const productCards = document.querySelectorAll('.product-card');
const emptyState = document.getElementById('empty-state');
const productsGrid = document.getElementById('products-grid');

filterButtons.forEach(button => {
    button.addEventListener('click', () => {
        const filter = button.getAttribute('data-filter');
        
        // Update active button
        filterButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        
        // Filter products and count visible
        let visibleCount = 0;
        productCards.forEach(card => {
            if (filter === 'all' || card.getAttribute('data-category') === filter) {
                card.style.display = 'block';
                card.style.animation = 'fadeIn 0.5s ease';
                visibleCount++;
            } else {
                card.style.display = 'none';
            }
        });
        
        // Show/hide empty state
        if (visibleCount === 0) {
            productsGrid.style.display = 'none';
            emptyState.style.display = 'block';
        } else {
            productsGrid.style.display = 'grid';
            emptyState.style.display = 'none';
        }
    });
});

// Add to Cart Functionality
document.querySelectorAll('.add-to-cart').forEach(button => {
    button.addEventListener('click', function() {
        const productId = this.getAttribute('data-product-id');
        const productName = this.getAttribute('data-name');
        const productPrice = parseFloat(this.getAttribute('data-price'));
        
        addToCart(productId, productName, productPrice);
        
        // Visual feedback
        this.textContent = 'Added!';
        this.style.background = '#10B981';
        setTimeout(() => {
            this.textContent = 'Add to Cart';
            this.style.background = '';
        }, 1000);
    });
});

function addToCart(id, name, price) {
    const existingItem = cart.find(item => item.id === id);
    
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({
            id: id,
            name: name,
            price: price,
            quantity: 1
        });
    }
    
    updateCartCount();
    saveCartToLocalStorage();
}

function updateCartCount() {
    const count = cart.reduce((total, item) => total + item.quantity, 0);
    // Update both desktop and mobile cart counts
    const cartCounts = document.querySelectorAll('#cart-count, #cart-count-mobile');
    cartCounts.forEach(el => {
        if (el) el.textContent = count;
    });
}

function saveCartToLocalStorage() {
    localStorage.setItem('cart', JSON.stringify(cart));
}

function loadCartFromLocalStorage() {
    const savedCart = localStorage.getItem('cart');
    if (savedCart) {
        cart = JSON.parse(savedCart);
        updateCartCount();
    }
}

// Cart Modal Management
const cartModal = document.getElementById('cart-modal');
const cartBtnMobile = document.querySelector('.cart-btn-mobile');
const closeModal = document.querySelector('.close-modal');

// Open cart modal from mobile button
cartBtnMobile.addEventListener('click', (e) => {
    e.preventDefault();
    displayCart();
    cartModal.style.display = 'block';
});

closeModal.addEventListener('click', () => {
    cartModal.style.display = 'none';
});

window.addEventListener('click', (e) => {
    if (e.target === cartModal) {
        cartModal.style.display = 'none';
    }
});

function displayCart() {
    const cartItemsContainer = document.getElementById('cart-items');
    const cartTotalElement = document.getElementById('cart-total');
    
    if (cart.length === 0) {
        cartItemsContainer.innerHTML = '<p style="text-align: center; color: #666;">Your cart is empty</p>';
        cartTotalElement.textContent = '$0';
        return;
    }
    
    let total = 0;
    let html = '';
    
    cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        
        html += `
            <div class="cart-item">
                <div class="cart-item-info">
                    <div class="cart-item-name">${item.name}</div>
                    <div class="cart-item-price">$${item.price} x ${item.quantity} = $${itemTotal}</div>
                </div>
                <button class="cart-item-remove" onclick="removeFromCart('${item.id}')">Remove</button>
            </div>
        `;
    });
    
    cartItemsContainer.innerHTML = html;
    cartTotalElement.textContent = `$${total}`;
}

function removeFromCart(id) {
    cart = cart.filter(item => item.id !== id);
    updateCartCount();
    saveCartToLocalStorage();
    displayCart();
}

// Checkout Functionality
document.querySelector('.checkout-btn').addEventListener('click', () => {
    if (cart.length === 0) {
        alert('Your cart is empty!');
        return;
    }
    
    // Here you would integrate with a payment processor like Stripe
    // For demonstration, we'll show an alert
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    // Create checkout session (placeholder)
    alert(`Proceeding to checkout with total: $${total}\n\nIn a production environment, this would redirect to a secure payment processor like Stripe or PayPal.`);
    
    // Example Stripe integration point:
    // stripeCheckout(cart, total);
});

// API endpoint - change this to your deployed API URL
const API_URL = process.env.API_URL || 'http://localhost:3001';

// Contact Form Handling
document.querySelector('.contact-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const submitButton = e.target.querySelector('button[type="submit"]');
    const originalText = submitButton.textContent;
    submitButton.textContent = 'Sending...';
    submitButton.disabled = true;
    
    const formData = new FormData(e.target);
    const data = {
        name: formData.get('name'),
        email: formData.get('email'),
        inquiryType: formData.get('inquiryType'),
        message: formData.get('message')
    };
    
    try {
        const response = await fetch(`${API_URL}/api/contact`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            alert('Thank you for your message! I will get back to you within 48 hours.');
            e.target.reset();
        } else {
            alert(result.error || 'Failed to send message. Please try again.');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to send message. Please try emailing me directly at me@minorkeith.com');
    } finally {
        submitButton.textContent = originalText;
        submitButton.disabled = false;
    }
});

// Navbar scroll effect
let lastScrollTop = 0;
const navbar = document.querySelector('.navbar');

window.addEventListener('scroll', () => {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    
    if (scrollTop > lastScrollTop && scrollTop > 100) {
        // Scrolling down
        navbar.style.transform = 'translateY(-100%)';
    } else {
        // Scrolling up
        navbar.style.transform = 'translateY(0)';
    }
    
    lastScrollTop = scrollTop;
});

// Waitlist functionality
document.querySelectorAll('.join-waitlist').forEach(button => {
    button.addEventListener('click', async function() {
        const product = this.getAttribute('data-product');
        const emailInput = this.parentElement.querySelector('.waitlist-email');
        const email = emailInput.value.trim();
        
        if (!email) {
            alert('Please enter your email address');
            return;
        }
        
        if (!validateEmail(email)) {
            alert('Please enter a valid email address');
            return;
        }
        
        const originalText = this.textContent;
        this.textContent = 'Joining...';
        this.disabled = true;
        
        try {
            const response = await fetch(`${API_URL}/api/waitlist`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, product })
            });
            
            const result = await response.json();
            
            if (response.ok) {
                // Visual feedback
                this.textContent = 'Added to Waitlist!';
                this.style.background = '#10B981';
                emailInput.value = '';
                emailInput.disabled = true;
                
                // Store locally as backup
                const waitlist = JSON.parse(localStorage.getItem('waitlist') || '[]');
                waitlist.push({ product, email, timestamp: new Date().toISOString() });
                localStorage.setItem('waitlist', JSON.stringify(waitlist));
            } else {
                alert(result.error || 'Failed to join waitlist. Please try again.');
                this.textContent = originalText;
                this.disabled = false;
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Failed to join waitlist. Please try emailing me directly at me@minorkeith.com');
            this.textContent = originalText;
            this.disabled = false;
        }
    });
});

function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    loadCartFromLocalStorage();
    
    // Add intersection observer for animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -100px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.animation = 'fadeInUp 0.6s ease forwards';
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);
    
    // Observe elements for animation
    document.querySelectorAll('.product-card, .stat-card, .contact-item').forEach(el => {
        observer.observe(el);
    });
});

// Stripe Integration (placeholder for future implementation)
function initializeStripe() {
    // This would be initialized with your Stripe publishable key
    // const stripe = Stripe('your-publishable-key-here');
    
    // Example function for creating a checkout session
    async function createCheckoutSession(items, total) {
        try {
            // In production, this would call your backend API to create a Stripe session
            const response = await fetch('/api/create-checkout-session', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    items: items,
                    total: total
                })
            });
            
            const session = await response.json();
            
            // Redirect to Stripe Checkout
            // const result = await stripe.redirectToCheckout({
            //     sessionId: session.id
            // });
            
        } catch (error) {
            console.error('Error creating checkout session:', error);
            alert('There was an error processing your payment. Please try again.');
        }
    }
}

// PayPal Integration (placeholder for future implementation)
function initializePayPal() {
    // This would be initialized with your PayPal client ID
    // paypal.Buttons({
    //     createOrder: function(data, actions) {
    //         return actions.order.create({
    //             purchase_units: [{
    //                 amount: {
    //                     value: calculateTotal()
    //                 }
    //             }]
    //         });
    //     },
    //     onApprove: function(data, actions) {
    //         return actions.order.capture().then(function(details) {
    //             alert('Transaction completed by ' + details.payer.name.given_name);
    //             clearCart();
    //         });
    //     }
    // }).render('#paypal-button-container');
}