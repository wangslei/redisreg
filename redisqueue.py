import redis


class RedisQueue(object):

    """Simple Queue with Redis Backend"""

    def __init__(self, name, namespace='queue', **redis_kwargs):
        """The default connection parameters are: host='localhost', port=6379, db=0"""
        self.__db= redis.Redis(**redis_kwargs)
        self.key = '%s:%s' %(namespace, name)


    def qsize(self):
        """Return the approximate size of the queue."""
        return self.__db.llen(self.key)


    def empty(self):
        """Return True if the queue is empty, False otherwise."""
        return self.qsize() == 0


    def put(self, item):
        """Put item into the queue."""
        self.__db.rpush(self.key, item)


    def get(self, block=True, timeout=None):
        """Remove and return an item from the queue. 

        If optional args block is true and timeout is None (the default), block
        if necessary until an item is available."""

        if block:
            item = self.__db.blpop(self.key, timeout=timeout)
        else:
            item = self.__db.lpop(self.key)

        if item:
            item = item[1]

        return item


    def get_nowait(self):
        """Equivalent to get(False)."""
        return self.get(False)

    

class RedisReg(object):
    def __init__(self, event_name):
        """The default connection parameters are: host='localhost', port=6379, db=0"""
        self.__db= redis.Redis('localhost')
        self.eventkey = event_name

        """self.namekey = '%s:%s' %(event_name, attendee_name)
        self.companykey = '%s:%s' %(event_name, attendee_company)
        self.emailkey = '%s:%s' %(event_name, attendee_email)"""

        
    def addattendee(self, attendee_name, attendee_email, attendee_company,):
        """check to see if attendee has already been added to this event"""
        if self.__db.sismember(self.eventkey+":names",attendee_name) or self.__db.sismember(self.eventkey+":emails",attendee_email):
            print "%s is already registered for this event", attendee_name
        else:
            self.__db.incr(self.eventkey)

            """add attendee info to hash"""
            self.__db.hmset(self.eventkey+":attendeeinfo"+self.__db.get(self.eventkey),
                {'name':attendee_name,'email':attendee_email,'company':attendee_company})
            
            """add attendee info to sets to allow for quick lookup of whether an attendee is already registered"""
            self.__db.sadd(self.eventkey+":names",attendee_name)
            self.__db.sadd(self.eventkey+":emails",attendee_email)

            """create indices for attendee's eventID based on their name and email"""
            self.__db.set(self.eventkey+":name:"+attendee_name,self.__db.get(self.eventkey))
            self.__db.set(self.eventkey+":email:"+attendee_email,self.__db.get(self.eventkey))

    def numattendees(self):
        return self.attendees_count

    def geteventIDbyName(self,attendee_name):
        if self.__db.sismember(self.eventkey+":names",attendee_name):
            return self.__db.get(self.eventkey+":name:"+attendee_name)
        else:
            return attendee_name+" is not registered"

    def geteventIDbyEmail(self,attendee_email):
        if self.__db.sismember(self.eventkey+":emails",attendee_email):
            return self.__db.get(self.eventkey+":email:"+attendee_email)
        else:
            return attendee_email+" is not registered"

    def getAttendeeEmails(self):
        return self.__db.smembers(self.eventkey+":emails")

    def getAttendeeInfo(self,id):
        return self.__db.hgetall(self.eventkey+":attendeeinfo"+id)

