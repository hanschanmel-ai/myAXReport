import datetime
import random

class ActivityMonitor:
    def __init__(self):
        # In a real app, this would connect to a network monitoring service
        # For this demo, we'll generate sample data
        pass
    
    def get_recent_activity(self):
        # In a real app, this would retrieve actual browsing activity
        # For this demo, we'll generate sample data
        
        sample_sites = [
            'google.com',
            'youtube.com',
            'facebook.com',
            'instagram.com',
            'tiktok.com',
            'twitter.com',
            'reddit.com',
            'wikipedia.org',
            'amazon.com',
            'netflix.com',
            'disney.com',
            'roblox.com',
            'minecraft.net',
            'school.edu',
            'learning.org',
            'games.com',
            'adultcontent.com'
        ]
        
        statuses = ['Allowed', 'Blocked']
        
        activities = []
        now = datetime.datetime.now()
        
        # Generate 10 random activities
        for i in range(10):
            time_offset = datetime.timedelta(minutes=random.randint(0, 60))
            activity_time = now - time_offset
            
            site = random.choice(sample_sites)
            
            # Determine status based on site content
            if 'adult' in site or 'game' in site:
                status = 'Blocked'
            elif 'school' in site or 'learning' in site:
                status = 'Allowed'
            else:
                status = random.choice(statuses)
            
            activities.append({
                'time': activity_time.strftime('%H:%M:%S'),
                'site': site,
                'status': status
            })
        
        # Sort by time (newest first)
        activities.sort(key=lambda x: x['time'], reverse=True)
        
        return activities
    
    def start_monitoring(self):
        # In a real app, this would start the network monitoring service
        pass
    
    def stop_monitoring(self):
        # In a real app, this would stop the network monitoring service
        pass