import { Router } from 'express';
import { requireAuth } from '../middlewares/rbac';
import { User } from '../models/user';

const router = Router();

router.put('/me', requireAuth, async (req:any,res,next)=>{
  try{
    const { name, phone, campus, avatarUrl } = req.body || {};
    const user = await User.findByIdAndUpdate(req.userId, { $set: { name, phone, campus, avatarUrl } }, { new:true });
    res.json({ ok:true, user: {
      id: String(user._id), name: user.name, email: user.email, role: user.role,
      campus: user.campus, phone: user.phone || '', avatarUrl: user.avatarUrl || ''
    }});
  }catch(e){ next(e); }
});

export default router;
