class UI {
    constructor() {
        this.menu = null;
        this.hostCode = null;
        this.joinInput = null;
        this.errorMessage = null;
    }

    initialize() {
        this.menu = document.createElement('div');
        this.menu.id = 'menu';
        this.menu.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            text-align: center;
            background: rgba(0, 0, 0, 0.8);
            padding: 20px;
            border-radius: 10px;
            color: white;
            font-family: Arial, sans-serif;
            min-width: 300px;
            z-index: 1000;
        `;

        const title = document.createElement('h2');
        title.textContent = 'WebXR Multiplayer';
        title.style.margin = '0 0 20px 0';
        this.menu.appendChild(title);

        // Host Code Display
        this.hostCode = document.createElement('div');
        this.hostCode.style.cssText = `
            margin: 20px;
            padding: 20px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 5px;
            font-size: 24px;
            display: none;
        `;
        this.menu.appendChild(this.hostCode);

        // Join Input
        this.joinInput = document.createElement('div');
        this.joinInput.style.cssText = `
            margin: 20px;
            padding: 10px;
            display: none;
        `;
        
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Enter 4-digit code';
        input.maxLength = 4;
        input.style.cssText = `
            padding: 10px;
            font-size: 18px;
            width: 120px;
            text-align: center;
            margin-bottom: 10px;
            border: none;
            border-radius: 5px;
        `;
        this.joinInput.appendChild(input);
        
        const joinButton = document.createElement('button');
        joinButton.textContent = 'Join';
        joinButton.style.cssText = `
            padding: 10px 20px;
            font-size: 18px;
            cursor: pointer;
            background: #4CAF50;
            color: white;
            border: none;
            border-radius: 5px;
            margin-left: 10px;
        `;
        this.joinInput.appendChild(joinButton);
        this.menu.appendChild(this.joinInput);

        // Error Message
        this.errorMessage = document.createElement('div');
        this.errorMessage.style.cssText = `
            color: #ff6b6b;
            margin: 10px;
            display: none;
            font-weight: bold;
        `;
        this.menu.appendChild(this.errorMessage);

        document.body.appendChild(this.menu);
        
        return {
            input,
            joinButton
        };
    }

    createButton(text, onClick) {
        const button = document.createElement('button');
        button.textContent = text;
        button.style.cssText = `
            padding: 10px 20px;
            margin: 10px;
            font-size: 18px;
            cursor: pointer;
            background: #4CAF50;
            color: white;
            border: none;
            border-radius: 5px;
            transition: background-color 0.3s;
        `;
        button.addEventListener('mouseover', () => {
            button.style.backgroundColor = '#45a049';
        });
        button.addEventListener('mouseout', () => {
            button.style.backgroundColor = '#4CAF50';
        });
        button.addEventListener('click', onClick);
        this.menu.appendChild(button);
        return button;
    }

    showHostCode(code) {
        this.hostCode.style.display = 'block';
        this.hostCode.innerHTML = `
            Your Room Code:<br>
            <span style="font-size: 48px; font-weight: bold; letter-spacing: 5px; color: #4CAF50;">${code}</span><br>
            <span style="font-size: 14px; opacity: 0.8;">Share this code with others to join</span>
        `;
    }

    showJoinInput() {
        this.joinInput.style.display = 'block';
    }

    showError(message) {
        this.errorMessage.style.display = 'block';
        this.errorMessage.textContent = message;
        setTimeout(() => {
            this.hideError();
        }, 3000);
    }

    hideError() {
        this.errorMessage.style.display = 'none';
    }

    hide() {
        this.menu.style.display = 'none';
    }

    show() {
        this.menu.style.display = 'block';
    }
}

export default UI;
