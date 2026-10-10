import logging
from abc import ABC, abstractmethod
from typing import Dict, Any, List
from datetime import datetime

logger = logging.getLogger("medisync.notifications")


class NotificationService(ABC):
    @abstractmethod
    def send(self, recipient: str, message: str, channel: str = "SMS") -> Dict[str, Any]:
        """Send notification via specified channel."""
        pass


class MockNotificationService(NotificationService):
    def __init__(self):
        self.dispatches: List[Dict[str, Any]] = []

    def send(self, recipient: str, message: str, channel: str = "SMS") -> Dict[str, Any]:
        header = "[WhatsApp - MediSync TN PHC]" if channel.upper() == "WHATSAPP" else "[SMS - TN Health Dept]"
        timestamp = datetime.utcnow().isoformat()
        full_msg = f"{header}\n{message}\nSent at: {timestamp}"

        record = {
            "id": f"notif_{int(datetime.utcnow().timestamp()*1000)}",
            "recipient": recipient,
            "channel": channel.upper(),
            "message": full_msg,
            "status": "delivered",
            "timestamp": timestamp
        }
        self.dispatches.append(record)

        # Log for dev observability
        logger.info(f"NOTIFICATION DISPATCHED: [{channel}] To {recipient}: {message}")
        try:
            print(f"\n[MOCK {channel.upper()}] To: {recipient}\n{full_msg}\n")
        except Exception:
            pass
        return record

    def get_recent(self, limit: int = 20) -> List[Dict[str, Any]]:
        return list(reversed(self.dispatches))[:limit]


# Pluggable singleton instance
notification_service = MockNotificationService()
