export const loadRazorpay = (retries = 3) => {
    return new Promise((resolve) => {
        const attemptLoad = (currentRetry) => {
            if (window.Razorpay) {
                resolve(true);
                return;
            }

            if (currentRetry <= 0) {
                resolve(false);
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://checkout.razorpay.com/v1/checkout.js';
            script.onload = () => {
                resolve(true);
            };
            script.onerror = () => {
                setTimeout(() => attemptLoad(currentRetry - 1), 2000); // Retry after 2 seconds
            };
            document.body.appendChild(script);
        };

        attemptLoad(retries);
    });
};
