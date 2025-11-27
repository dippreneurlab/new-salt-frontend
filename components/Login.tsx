'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import BrandedHeader from './BrandedHeader';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { getClientAuth } from '@/lib/firebaseClient';

interface LoginProps {
  onLogin: (userData: { email: string; name: string; role: 'admin' | 'pm' | 'user' }) => void;
  onShowSignUp: () => void;
}

declare global {
  interface Window {
    grecaptcha?: any;
  }
}

export default function Login({ onLogin, onShowSignUp }: LoginProps) {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [recaptchaReady, setRecaptchaReady] = useState(false);
  const [recaptchaToken, setRecaptchaToken] = useState('');

  const recaptchaRef = useRef<HTMLDivElement | null>(null);
  const recaptchaWidgetId = useRef<number | null>(null);
  const recaptchaSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

  // Load Google reCAPTCHA script
  useEffect(() => {
    if (!recaptchaSiteKey) return;

    const onReady = () => setRecaptchaReady(true);
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://www.google.com/recaptcha/api.js?render=explicit"]'
    );

    if (existing) {
      if (window.grecaptcha) {
        onReady();
      } else {
        existing.addEventListener('load', onReady, { once: true });
        return () => existing.removeEventListener('load', onReady);
      }
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://www.google.com/recaptcha/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.addEventListener('load', onReady, { once: true });
    document.body.appendChild(script);

    return () => {
      script.removeEventListener('load', onReady);
    };
  }, [recaptchaSiteKey]);

  // Render reCAPTCHA widget once ready
  useEffect(() => {
    if (!recaptchaReady || !recaptchaSiteKey || !recaptchaRef.current || !window.grecaptcha) return;
    if (recaptchaWidgetId.current !== null) return;

    recaptchaWidgetId.current = window.grecaptcha.render(recaptchaRef.current, {
      sitekey: recaptchaSiteKey,
      callback: (token: string) => {
        setRecaptchaToken(token);
        setErrors(prev => ({ ...prev, recaptcha: '' }));
      },
      'expired-callback': () => {
        setRecaptchaToken('');
        setErrors(prev => ({ ...prev, recaptcha: 'Captcha expired, please try again.' }));
      },
      'error-callback': () => {
        setRecaptchaToken('');
        setErrors(prev => ({ ...prev, recaptcha: 'Captcha failed to load. Please refresh and try again.' }));
      }
    });
  }, [recaptchaReady, recaptchaSiteKey]);

  const resetRecaptcha = () => {
    if (recaptchaWidgetId.current !== null && window.grecaptcha?.reset) {
      window.grecaptcha.reset(recaptchaWidgetId.current);
      setRecaptchaToken('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setFormError(null);
    setErrors({});
    
    const newErrors: { [key: string]: string } = {};
    if (!formData.email) newErrors.email = 'Email is required';
    if (!formData.password) newErrors.password = 'Password is required';
    if (recaptchaSiteKey && !recaptchaToken) {
      newErrors.recaptcha = recaptchaReady
        ? 'Please complete the captcha'
        : 'Captcha is still loading, please wait a moment';
    }
    
    if (Object.keys(newErrors).length > 0) {
      if (newErrors.recaptcha) resetRecaptcha();
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      const auth = getClientAuth();
      if (!auth) {
        throw new Error('Firebase auth not configured');
      }
      const credential = await signInWithEmailAndPassword(auth, formData.email, formData.password);
      const authedUser = credential.user;
      const token = await authedUser.getIdTokenResult(true);
      const roleClaim = (token.claims.role as string) || 'user';
      const name = authedUser.displayName || authedUser.email?.split('@')[0] || 'User';
      onLogin({
        email: authedUser.email || formData.email,
        name: name.charAt(0).toUpperCase() + name.slice(1),
        role: roleClaim as 'admin' | 'pm' | 'user'
      });
    } catch (err) {
      console.error('Firebase sign-in failed', err);
      setFormError('Unable to sign in. Check your credentials and try again.');
      resetRecaptcha();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <BrandedHeader />
      
      <div className="flex items-center justify-center pt-20">
        <div className="w-full max-w-md">
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl font-bold text-gray-900">Welcome Back</CardTitle>
              <CardDescription>Sign in to access SaltPM</CardDescription>
            </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  placeholder="Enter your email"
                  className={errors.email ? 'border-red-500' : ''}
                />
                {errors.email && (
                  <p className="text-sm text-red-600">{errors.email}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  placeholder="Enter your password"
                  className={errors.password ? 'border-red-500' : ''}
                />
                {errors.password && (
                  <p className="text-sm text-red-600">{errors.password}</p>
                )}
              </div>

              {recaptchaSiteKey ? (
                <div className="space-y-2">
                  <Label>Human Check</Label>
                  <div className="rounded-md border border-gray-200 p-3 bg-gray-50">
                    <div ref={recaptchaRef} className="flex justify-center" />
                  </div>
                  {errors.recaptcha && (
                    <p className="text-sm text-red-600">{errors.recaptcha}</p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-amber-600">
                  reCAPTCHA key missing. Add NEXT_PUBLIC_RECAPTCHA_SITE_KEY to enable bot protection.
                </p>
              )}

              {formError && (
                <p className="text-sm text-red-600">{formError}</p>
              )}

              <div className="pt-4">
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? 'Signing in...' : 'Sign In'}
                </Button>
              </div>
            </form>

            <div className="mt-6 text-center space-y-3">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="bg-white px-2 text-gray-500">New to Salt XC?</span>
                </div>
              </div>
              
              <Button 
                type="button" 
                variant="outline" 
                className="w-full"
                onClick={onShowSignUp}
              >
                Create New Account
              </Button>
              
              <p className="text-xs text-gray-500">
                Login with your Salt Email
              </p>
            </div>
          </CardContent>
        </Card>
        </div>
      </div>
    </div>
  );
}
