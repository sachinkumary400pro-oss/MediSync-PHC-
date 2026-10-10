/**
 * MediSync PHC - Pluggable SMS and WhatsApp Notification Service
 * In development, messages are logged, saved to database, and displayed in real-time notification feeds.
 */

function sendNotification(db, { recipientPhone, recipientRole, channel = 'SMS', message }) {
  const id = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  
  const header = channel === 'WHATSAPP' 
    ? '🟢 [WhatsApp - MediSync TN PHC Portal]' 
    : '📱 [SMS - TN Health Dept MediSync]';

  const fullMessage = `${header}\n${message}\nDate: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`;

  try {
    const stmt = db.prepare(`
      INSERT INTO notifications (id, recipient_phone, recipient_role, channel, message, status)
      VALUES (?, ?, ?, ?, ?, 'delivered')
    `);
    stmt.run(id, recipientPhone, recipientRole, channel, fullMessage);

    console.log(`\n================= NOTIFICATION SENT =================`);
    console.log(`Channel: ${channel} | To: ${recipientPhone} (${recipientRole})`);
    console.log(`Message:\n${fullMessage}`);
    console.log(`=====================================================\n`);

    return {
      success: true,
      id,
      channel,
      recipientPhone,
      recipientRole,
      message: fullMessage,
      status: 'delivered',
      timestamp: new Date().toISOString()
    };
  } catch (err) {
    console.error('Failed to send notification:', err);
    return { success: false, error: err.message };
  }
}

function getRecentNotifications(db, limit = 20) {
  return db.prepare(`
    SELECT * FROM notifications
    ORDER BY created_at DESC
    LIMIT ?
  `).all(limit);
}

module.exports = {
  sendNotification,
  getRecentNotifications
};
