const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

app.post('/send-report', async (req, res) => {
  const { emailConfig, reportData } = req.body;

  try {
    const transporter = nodemailer.createTransporter({
      host: emailConfig.smtpHost,
      port: emailConfig.smtpPort,
      secure: emailConfig.secure,
      auth: {
        user: emailConfig.smtpUser,
        pass: emailConfig.smtpPassword
      }
    });

    const mailOptions = {
      from: emailConfig.fromAddress,
      to: emailConfig.toAddress,
      subject: 'Reporte de Ventas - Ronatug',
      text: `Reporte: ${JSON.stringify(reportData, null, 2)}`
    };

    const info = await transporter.sendMail(mailOptions);
    res.json({ success: true, info });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});